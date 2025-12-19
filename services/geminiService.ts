
import { GoogleGenAI } from "@google/genai";
import { AppData } from '../types';

// Use the API key directly from process.env as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeProcurementData = async (data: AppData): Promise<string> => {
  // Guidelines: Assume process.env.API_KEY is pre-configured and accessible.
  if (!process.env.API_KEY) {
    return "API Key Gemini non configurata (process.env.API_KEY).";
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
    // Calling generateContent with the recommended model for basic text analysis tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Accessing the .text property directly as it returns the generated string.
    return response.text || "Nessuna risposta.";
  } catch (error) {
    console.error("Errore Gemini:", error);
    return "Errore nell'analisi AI.";
  }
};
