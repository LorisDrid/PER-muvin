const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

async function analyzeDatePatterns() {
    try {
        // Lire le fichier CSV
        const RESOURCE_DIR = path.join(process.cwd(), '../resources');
        const inputFile = path.join(RESOURCE_DIR, 'Restitution.csv');
        const fileContent = fs.readFileSync(inputFile, 'utf8');
        
        const parsedData = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true
        });

        console.log(`Analyzing ${parsedData.data.length} entries...`);

        // Structures pour stocker les différents patterns
        const datePatterns = {
            singleYears: new Set(),              // ex: "1942"
            yearRanges: new Set(),               // ex: "1939-1945"
            yearSlashes: new Set(),              // ex: "1939/1945"
            betweenYears: new Set(),             // ex: "between 1939 and 1945"
            untilYears: new Set(),               // ex: "until 1945"
            fromYears: new Set(),                // ex: "from 1939"
            beforeAfterYears: new Set(),         // ex: "before 1945", "after 1939"
            monthYears: new Set(),               // ex: "March 1945"
            approximateYears: new Set(),         // ex: "ca. 1945", "around 1945"
            complexRanges: new Set()             // ex: "1939/40-1945"
        };

        // Analyser chaque entrée
        parsedData.data.forEach((row, index) => {
            if (!row.Provenance) return;

            const cleanedText = row.Provenance
                .replace(/;Read more;Read less/g, '')
                .replace(/;Read more/, '')
                .replace(/;Read less/, '')
                .trim();

            // Chercher les différents patterns de dates
            // 1. Années simples
            const singleYears = cleanedText.match(/\b(19|20)\d{2}\b/g);
            if (singleYears) {
                singleYears.forEach(year => {
                    datePatterns.singleYears.add(`${cleanedText}\n -> ${year}`);
                });
            }

            // 2. Périodes avec tiret
            const yearRanges = cleanedText.match(/\b(19|20)\d{2}-(19|20)\d{2}\b/g);
            if (yearRanges) {
                yearRanges.forEach(range => {
                    datePatterns.yearRanges.add(`${cleanedText}\n -> ${range}`);
                });
            }

            // 3. Années avec slash
            const yearSlashes = cleanedText.match(/\b(19|20)\d{2}\/(19|20)?\d{2}\b/g);
            if (yearSlashes) {
                yearSlashes.forEach(slashYear => {
                    datePatterns.yearSlashes.add(`${cleanedText}\n -> ${slashYear}`);
                });
            }

            // 4. "between X and Y"
            const betweenYears = cleanedText.match(/between\s+(19|20)\d{2}\s+and\s+(19|20)\d{2}/g);
            if (betweenYears) {
                betweenYears.forEach(between => {
                    datePatterns.betweenYears.add(`${cleanedText}\n -> ${between}`);
                });
            }

            // 5. "until X"
            const untilYears = cleanedText.match(/until\s+(19|20)\d{2}/g);
            if (untilYears) {
                untilYears.forEach(until => {
                    datePatterns.untilYears.add(`${cleanedText}\n -> ${until}`);
                });
            }

            // 6. "from X"
            const fromYears = cleanedText.match(/from\s+(19|20)\d{2}/g);
            if (fromYears) {
                fromYears.forEach(from => {
                    datePatterns.fromYears.add(`${cleanedText}\n -> ${from}`);
                });
            }

            // 7. "before/after X"
            const beforeAfterYears = cleanedText.match(/(before|after)\s+(19|20)\d{2}/g);
            if (beforeAfterYears) {
                beforeAfterYears.forEach(beforeAfter => {
                    datePatterns.beforeAfterYears.add(`${cleanedText}\n -> ${beforeAfter}`);
                });
            }

            // 8. Mois + année
            const monthYears = cleanedText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(19|20)\d{2}\b/g);
            if (monthYears) {
                monthYears.forEach(monthYear => {
                    datePatterns.monthYears.add(`${cleanedText}\n -> ${monthYear}`);
                });
            }

            // 9. Dates approximatives
            const approximateYears = cleanedText.match(/\b(ca\.|around|approximately|circa)\s+(19|20)\d{2}\b/g);
            if (approximateYears) {
                approximateYears.forEach(approx => {
                    datePatterns.approximateYears.add(`${cleanedText}\n -> ${approx}`);
                });
            }

            // 10. Ranges complexes
            const complexRanges = cleanedText.match(/\b(19|20)\d{2}\/\d{2}-(19|20)\d{2}\b/g);
            if (complexRanges) {
                complexRanges.forEach(complex => {
                    datePatterns.complexRanges.add(`${cleanedText}\n -> ${complex}`);
                });
            }
        });

        // Enregistrer les résultats dans un fichier
        const output = {
            summary: {
                totalEntries: parsedData.data.length,
                patternCounts: {
                    singleYears: datePatterns.singleYears.size,
                    yearRanges: datePatterns.yearRanges.size,
                    yearSlashes: datePatterns.yearSlashes.size,
                    betweenYears: datePatterns.betweenYears.size,
                    untilYears: datePatterns.untilYears.size,
                    fromYears: datePatterns.fromYears.size,
                    beforeAfterYears: datePatterns.beforeAfterYears.size,
                    monthYears: datePatterns.monthYears.size,
                    approximateYears: datePatterns.approximateYears.size,
                    complexRanges: datePatterns.complexRanges.size
                }
            },
            examples: {
                singleYears: Array.from(datePatterns.singleYears),
                yearRanges: Array.from(datePatterns.yearRanges),
                yearSlashes: Array.from(datePatterns.yearSlashes),
                betweenYears: Array.from(datePatterns.betweenYears),
                untilYears: Array.from(datePatterns.untilYears),
                fromYears: Array.from(datePatterns.fromYears),
                beforeAfterYears: Array.from(datePatterns.beforeAfterYears),
                monthYears: Array.from(datePatterns.monthYears),
                approximateYears: Array.from(datePatterns.approximateYears),
                complexRanges: Array.from(datePatterns.complexRanges)
            }
        };

        const outputFile = path.join(RESOURCE_DIR, 'date_patterns_analysis.json');
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`\nAnalysis complete. Results saved to ${outputFile}`);
        console.log('\nSummary of patterns found:');
        console.log(output.summary.patternCounts);

    } catch (error) {
        console.error('Error during processing:', error);
    }
}

analyzeDatePatterns();