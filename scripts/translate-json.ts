import fs from 'fs';
import path from 'path';

const inputDir = './public/roadmap-content';

function translateFile(filePath) {
    console.log(`Traduzindo arquivo: ${filePath}`);
    // A lógica de tradução real seria feita chamando a skill ou API de tradução.
    // Para efeito deste script, simularemos a criação do arquivo traduzido.
    const outputFilePath = filePath.replace('.json', '-pt-br.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Simulação: substituição básica de chaves (a tradução real seria feita por LLM)
    const translatedContent = content.replace(/"title": "/g, '"title": "TRADUZIDO_');
    fs.writeFileSync(outputFilePath, translatedContent);
    console.log(`Gerado: ${outputFilePath}`);
}

const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.json') && !file.endsWith('-pt-br.json'));
files.forEach(file => translateFile(path.join(inputDir, file)));
console.log("Tradução de JSONs concluída.");
