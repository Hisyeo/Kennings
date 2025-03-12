import 'dotenv/config';
import axios from 'axios';
import Fuse from 'fuse.js';

const definitions = (await axios(process.env.PANLEXIA_DEFINITIONS_TSV)).data

const definitionRows = String(definitions)
  .split('\n')
  .slice(1)
  .filter(row => row.length > 0)
  .map(row => {
    const columns = row.split('\t');
    return {
      concept: columns[0],
      stripped: columns[0].split(':')[1].split('.')[0],
      definition: columns[1].slice(0,columns[1].length - 1)
    }
})

export const searchDefinitions = id => {
  const definitionIndex = definitionRows.map(d => d.concept).indexOf(id);
  if (definitionIndex > -1) {
    return definitionRows[definitionIndex].definition
  } else {
    throw new Error(`unable to find ${id}`)
  }
}

const english = (await axios(process.env.PANLEXIA_ENGLISH_TSV)).data

const englishRows = String(english)
  .split('\n')
  .slice(1)
  .filter(row => row.length > 0)
  .map(row => {
    const columns = row.split('\t')
    return {
      concept: columns[0],
      stripped: columns[0].split(':')[1].split('.')?.[0],
      style: columns[1],
      word: columns[2],
      transcription: columns[3],
      etymology: columns[4]}
})
const englishIds = englishRows.map(r => r.concept);
for (let definition of definitionRows) {
  if (englishIds.indexOf(definition.concept) == -1) englishRows.push(definition);
}
const englishFuse = new Fuse(englishRows, {
  ignoreDiacritics: true,
  minMatchCharLength: 2,
  threshold: 0.01,
  distance: 5,
  keys: ['stripped', 'word']
})

export const searchEnglish = word => {
  const result = englishFuse.search(word);
  return result.map(match => {
    const { item: { concept, word, stripped } } = match;
    return { concept, word: word ?? stripped, definition: searchDefinitions(concept) }
  })
}

console.log(searchEnglish('battle'));