import { GoogleGenAI } from "@google/genai";
import { AppData } from '../types';

const apiKey = process.env.REACT_APP_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeProcurementData = async (data: AppData): Promise<string> => {
  if (!apiKey) {
    return "API Key Gemini non configurata (REACT_APP_API_KEY).";
  }

  const supplierSummaries = data.suppliers.map(s => {
    const supplierOrders = data.orders.filter(o => o.supplierId === s.id);
    const totalSpent = supplierOrders.reduce((acc, order) => {
       return acc + order.items.reduce((sum, item) => sum + item.actualCost, 0);
    }, 0);
    return {
      name: s.name,
      budget: s.contractValue,
      spent: totalSpent,
      remaining: s.contractValue - totalSpent
    };
  });

  const prompt = `
    Analizza questi dati di formazione e fornitori. Fornisci 3 brevi spunti critici (max 2 righe l'uno).
    Dati: ${JSON.stringify(supplierSummaries)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Nessuna risposta.";
  } catch (error) {
    return "Errore AI.";
  }
};