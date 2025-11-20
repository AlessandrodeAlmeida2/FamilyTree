import { GoogleGenAI } from "@google/genai";
import { Person } from '../types';

// Initialize Gemini Client
// Note: In a real deployment, ensure process.env.API_KEY is set. 
// For this demo, we handle the missing key gracefully in the UI.
const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateBiography = async (person: Person): Promise<string> => {
  if (!ai) {
    return "Chave da API Gemini não configurada. Adicione a API KEY para gerar biografias automáticas.";
  }

  const prompt = `
    Atue como um genealogista profissional. Escreva uma breve biografia narrativa (máximo 100 palavras) em Português para a seguinte pessoa baseada nos dados do GEDCOM:
    Nome: ${person.name} ${person.surname}
    Sexo: ${person.sex}
    Nascimento: ${person.birth?.date || 'Desconhecido'} em ${person.birth?.place || 'Desconhecido'}
    Falecimento: ${person.death?.date || 'Vivo/Desconhecido'} em ${person.death?.place || 'Desconhecido'}
    
    Se os dados forem escassos, escreva algo poético sobre a importância da memória familiar.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar a biografia.";
  } catch (error) {
    console.error("Erro ao gerar biografia:", error);
    return "Erro ao conectar com o Gemini para gerar a biografia.";
  }
};