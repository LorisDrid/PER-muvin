import spacy
import json
import requests
from pathlib import Path
import re
from time import sleep
from datetime import datetime
from typing import Set, List, Dict, Any
import logging
import random

class NameValidator:
    def __init__(self):
        self.nlp = spacy.load('en_core_web_lg')
        self.setup_logging()
        self.retry_count = 3
        self.base_delay = 2  # secondes

    def setup_logging(self):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def exponential_backoff(self, attempt: int) -> int:
        """Calcule le délai d'attente avec un backoff exponentiel et du jitter"""
        delay = min(30, self.base_delay * (2 ** attempt))  # max 30 secondes
        jitter = random.uniform(0, 0.1 * delay)  # 10% de jitter
        return delay + jitter

    def search_wikidata_with_retry(self, name: str) -> List[Dict[str, Any]]:
        """Version non-async de la fonction de recherche avec retry"""
        for attempt in range(self.retry_count):
            try:
                return self.search_wikidata(name)
            except requests.exceptions.RequestException as e:
                if "429" in str(e) and attempt < self.retry_count - 1:
                    delay = self.exponential_backoff(attempt)
                    self.logger.warning(f"Rate limit hit. Waiting {delay:.2f}s before retry {attempt + 1}/{self.retry_count}")
                    sleep(delay)
                    continue
                raise
        return []

    def filter_names(self, names: Set[str]) -> List[str]:
        filtered_names = []
        
        for name in names:
            doc = self.nlp(name)
            is_valid_entity = any(ent.label_ in ['PERSON', 'ORG'] for ent in doc.ents)
            
            basic_rules = not (
                name.upper() == name or
                'PAINTINGS' in name or
                bool(re.match(r'^[A-Z\s]+$', name)) or
                len(name) < 4 or
                bool(re.search(r'\d', name)) or
                bool(re.search(r'[^a-zA-Z\s\-\']', 
                    re.sub(r'^(Mr\.|Mrs\.|Dr\.|Prof\.)', '', name)))
            )
            
            if is_valid_entity and basic_rules:
                filtered_names.append(name)
                
        return filtered_names

    def search_wikidata(self, name: str) -> List[Dict[str, Any]]:
        try:
            search_url = "https://www.wikidata.org/w/api.php"
            params = {
                "action": "wbsearchentities",
                "search": name,
                "language": "en",
                "format": "json",
                "limit": 5
            }
            
            response = requests.get(search_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if not data.get('search'):
                return []

            enriched_results = []
            for result in data['search']:
                entity_params = {
                    "action": "wbgetentities",
                    "ids": result['id'],
                    "languages": "en",
                    "format": "json"
                }
                
                entity_response = requests.get(search_url, params=entity_params)
                entity_response.raise_for_status()
                entity_data = entity_response.json()
                entity = entity_data['entities'][result['id']]
                
                description = (
                    entity.get('descriptions', {})
                    .get('en', {})
                    .get('value', result.get('description', 'No description available'))
                )
                
                desc_lower = description.lower()
                is_art_related = any(term in desc_lower for term in [
                    'art', 'collector', 'dealer', 'gallery', 'museum',
                    'painter', 'sculptor', 'artist', 'curator'
                ])
                
                if is_art_related:
                    enriched_results.append({
                        'name': result['label'],
                        'wikidata': f"http://www.wikidata.org/entity/{result['id']}",
                        'description': description,
                        'score': result.get('score', 0)
                    })

            return sorted(enriched_results, key=lambda x: x['score'], reverse=True)

        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error searching Wikidata for {name}: {e}")
            raise

    def validate_names(self):
        resource_dir = Path('../resources')
        input_file = resource_dir / 'scumbag_article.json'
        
        with open(input_file, 'r', encoding='utf-8') as f:
            article_data = json.load(f)
        
        potential_names = set(article_data['allPotentialNames'])
        self.logger.info(f"Found {len(potential_names)} potential names")
        
        filtered_names = self.filter_names(potential_names)
        self.logger.info(f"Filtered to {len(filtered_names)} valid names")
        
        validated_names = []
        corrections = []
        
        for name in filtered_names:
            try:
                results = self.search_wikidata_with_retry(name)
                
                if results:
                    if results[0]['name'].lower() != name.lower():
                        corrections.append({
                            'original': name,
                            'corrected': results[0]['name'],
                            'confidence': results[0]['score']
                        })
                        self.logger.info(f"🔄 Corrected: {name} → {results[0]['name']}")
                    
                    validated_names.append({
                        'name': name,
                        'validations': [
                            {
                                'wikidata': r['wikidata'],
                                'description': r['description'],
                                'confidence': r['score']
                            }
                            for r in results
                        ]
                    })
                    self.logger.info(f"✓ Validated: {name}")
                else:
                    self.logger.info(f"✗ Not found: {name}")
                
                # Délai de base entre les requêtes
                sleep(self.base_delay)

            except Exception as e:
                self.logger.error(f"Error processing {name}: {e}")
                continue

        validation_results = {
            'totalNamesFound': len(potential_names),
            'namesAfterFiltering': len(filtered_names),
            'corrections': corrections,
            'validatedNames': validated_names,
            'validationDate': str(datetime.now())
        }

        output_file = resource_dir / 'validated_names_python.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(validation_results, f, indent=2)

        self.logger.info("\nValidation Summary:")
        self.logger.info(f"Total names found: {len(potential_names)}")
        self.logger.info(f"Names after filtering: {len(filtered_names)}")
        self.logger.info(f"Names validated: {len(validated_names)}")

if __name__ == "__main__":
    validator = NameValidator()
    validator.validate_names()