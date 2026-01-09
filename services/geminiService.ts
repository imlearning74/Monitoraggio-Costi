
import { GoogleGenAI } from "@google/genai";
import { AppData } from '../types';

export const analyzeProcurementData = async (data: AppData): Promise<string> => {
  // Otteniamo la chiave API dall'ambiente (iniettata automaticamente)
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.error("Gemini API Key non configurata.");
    return "Errore: Chiave API non configurata nel sistema. Contatta l'amministratore.";
  }

  // Inizializzazione istanza come da linee guida
  const ai = new GoogleGenAI({ apiKey });

  // Preparazione dei dati sintetici per l'AI
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
    Agisci come un senior financial controller. 
    Analizza questi dati di spesa formazione e fornisci 3 brevi insight strategici in italiano (max 2 righe l'uno).
    Usa un tono professionale e focalizzati su efficienza del budget e rischi di overspending.

    Dati: ${JSON.stringify(supplierSummaries)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    // .text è una proprietà getter, non un metodo
    const textOutput = response.text;
    if (!textOutput) throw new Error("Risposta vuota dal modello");
    
    return textOutput;
  } catch (error: any) {
    console.error("Errore API Gemini:", error);
    return `L'analisi AI non è riuscita: ${error.message || 'Errore di comunicazione con il modello'}.`;
  }
};
