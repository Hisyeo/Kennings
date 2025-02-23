import 'dotenv/config';
import axios from 'axios';
import Fuse from 'fuse.js';

const definitions = (await axios(process.env.PANLEXIA_DEFINITIONS_TSV)).data

const definitionRows = String(definitions).split('\n').map(row => [...row.split('\t')])

const searchDefinitions = id => definitionRows.find(column => column[0] == id)[1]

const english = (await axios(process.env.PANLEXIA_ENGLISH_TSV)).data

const englishRows = String(english).split('\n').map(row => {
  const columns = row.split('\t')
  return {id: columns[0], style: columns[1], word: columns[2], transcription: columns[3], etymology: columns[4]}
})

const englishFuse = new Fuse(englishRows, {
  ignoreDiacritics: true,
  minMatchCharLength: 2,
  threshold: 0.3,
  keys: ['word']
})

export const searchEnglish = word => englishFuse.search(word).map(match => {
  const { item: { id, word } } = match;
  return { id, word, definition: searchDefinitions(id) }
});