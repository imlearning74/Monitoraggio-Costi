
import { GoogleGenAI } from "@google/genai";
import { AppData } from '../types';

export const analyzeProcurementData = async (data: AppData): Promise<string> => {
  // Guidelines: Inizializza l'istanza sempre all'interno della funzione
  // per assicurarsi di leggere il valore più aggiornato di process.env.API_KEY
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    return "CONFIG_REQUIRED"; // Codice speciale per indicare che serve una chiave
  }

  // Create a new GoogleGenAI instance right before making an API call
  const ai = new GoogleGenAI({ apiKey });

  const supplierSummaries = data.suppliers.map(s => {
    const supplierOrders = data.orders.filter(o => o.supplierId === s.id);
    const totalActual = supplierOrders.reduce((acc, order) => {
       return acc + order.items.reduce((sum, item) => sum + item.actualCost, 0);
    }, 0);
    const totalPlanned = supplierOrders.reduce((acc, order) => {
       return acc + order.items.reduce((sum, item) => sum + item.plannedCost, 0);
    }, 0);

    return {
      fornitore: s.name,
      budget_contrattuale: s.contractValue,
      consuntivato: totalActual,
      impegnato: Math.max(0, totalPlanned - totalActual),
      residuo_libero: Math.max(0, s.contractValue - Math.max(totalPlanned, totalActual))
    };
  });

  const prompt = `
    Analizza i seguenti dati di procurement formazione e fornisci 3 brevi insight strategici in italiano (max 2 righe l'uno).
    Dati: ${JSON.stringify(supplierSummaries)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Passiamo al modello Pro per analisi più profonde
      contents: prompt,
    });
    
    // Guidelines: Use .text property (not a method)
    return response.text || "Nessun insight prodotto per questi dati.";
  } catch (error: any) {
    console.error("Errore API Gemini:", error);
    
    // Gestione specifica per chiavi disabilitate o compromesse
    const errorMsg = error.message?.toLowerCase() || "";
    if (
      errorMsg.includes("leaked") || 
      errorMsg.includes("403") || 
      error.status === "PERMISSION_DENIED" ||
      errorMsg.includes("requested entity was not found")
    ) {
        return "KEY_DISABLED"; // Codice speciale per chiave non valida
    }
    
    return `L'analisi AI è fallita: ${error.message || 'Errore di connessione'}.`;
  }
};
