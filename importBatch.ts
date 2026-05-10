import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import { GoogleGenAI, Type } from '@google/genai';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const titles = [
  "Saving Private Ryan", "Gladiator", "Gladiator II", "Waterworld", "Baby Driver",
  "Cast Away", "The Terminal", "Catch Me If You Can", "Commando", "1917",
  "13 Hours: The Secret Soldiers of Benghazi", "The Wolf of Wall Street",
  "Around the World in 80 Days", "The Great Wall", "Interstellar", "Inception",
  "Tenet", "Oppenheimer", "1899", "House of the Dragon", "The Pursuit of Happyness",
  "After Earth", "The Karate Kid", "I, Robot", "Aladdin", "Blade Runner 2049",
  "Passengers", "Edge of Tomorrow", "The Electric State", "Tropic Thunder",
  "The Lord of the Rings: The Rings of Power", "The Hobbit: An Unexpected Journey",
  "The Hobbit: The Desolation of Smaug", "The Hobbit: The Battle of the Five Armies",
  "Pixels", "Fight Club", "F1"
];

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
  console.log(`Starting import of ${titles.length} titles...`);
  for (let i = 0; i < titles.length; i++) {
    const titleName = titles[i];
    console.log(`[${i+1}/${titles.length}] Processing: ${titleName}`);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find details for the movie or TV show: "${titleName}". Use the googleSearch tool to fetch accurate metadata including a valid high resolution movie poster image URL. Return a raw JSON object only. For the poster, find a URL from TMDB, IMDB, Wikipedia, or any image hosting site.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              type: { type: Type.STRING, description: "'movie' or 'tv'" },
              year: { type: Type.STRING },
              director: { type: Type.STRING },
              genre: { type: Type.STRING },
              rating: { type: Type.STRING },
              synopsis: { type: Type.STRING },
              poster: { type: Type.STRING },
              cast: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "type"]
          }
        }
      });
      
      const jsonText = response.text || "{}";
      const itemData = JSON.parse(jsonText);
      
      if (!itemData.title || !itemData.type) {
         console.warn(`Missing title or type for ${titleName}, skipping.`);
         continue;
      }
      
      const itemId = Date.now() + i;
      await setDoc(doc(db, 'titles', itemId.toString()), {
        ...itemData,
        id: itemId,
        status: 'plan',
        progress: 0
      });
      console.log(`  -> Added ${itemData.title} to database.`);
    } catch (e: any) {
      console.error(`  -> Failed: ${e.message}`);
    }
    // Rate limiting
    await delay(3000);
  }
  console.log("Done adding titles!");
  process.exit(0);
}

main();
