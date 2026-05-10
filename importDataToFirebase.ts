import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { presetTitles } from './src/presets.js';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

async function main() {
  console.log(`Starting import of ${presetTitles.length} titles...`);
  for (let i = 0; i < presetTitles.length; i++) {
    const itemData = presetTitles[i];
    const itemId = Date.now() + i;
    try {
      await setDoc(doc(db, 'titles', itemId.toString()), {
        ...itemData,
        id: itemId,
        status: 'plan',
        progress: 0
      });
      console.log(`  -> Added ${itemData.title} to database.`);
    } catch (e: any) {
      console.error(`  -> Failed to add ${itemData.title}: ${e.message}`);
    }
  }
  console.log("Done adding titles!");
  process.exit(0);
}

main();
