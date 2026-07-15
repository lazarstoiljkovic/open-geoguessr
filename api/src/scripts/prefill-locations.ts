
import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { Container } from 'typedi';
import mongoLoader from 'src/loaders/mongo.loader';
import { LocationService } from 'src/services/location.service';
import { CachedLocationRepository } from 'src/database/repositories/cached-location.repository';

async function main() {
  const target  = parseInt(process.argv[2] ?? '200', 10);
  const workers = parseInt(process.argv[3] ?? '5',   10);

  await mongoLoader();

  const locationService = Container.get(LocationService);
  const repo = Container.get(CachedLocationRepository);
  const alreadyInDb = await repo.count();

  console.log(`\n  Prefill starting`);
  console.log(`  Target  : ${target} new locations`);
  console.log(`  Workers : ${workers} parallel`);
  console.log(`  In DB   : ${alreadyInDb} existing\n`);

  let filled = 0;
  let errors = 0;
  const startTime = Date.now();

  const worker = async () => {
    while (filled < target) {
      try {
        const loc = await locationService.discoverAndSave();
        filled++;
        const elapsedS = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = (filled / ((Date.now() - startTime) / 1000)).toFixed(2);
        console.log(
          `[${String(filled).padStart(4)}/${target}]  ${elapsedS}s  ${rate}/s  —  ${loc.name}, ${loc.country}  (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`,
        );
      } catch (err) {
        errors++;
        console.error(`[ERR] ${err instanceof Error ? err.message : String(err)}`);
        if (errors > 20) {
          console.error('Too many consecutive errors — stopping worker');
          return;
        }
      }
    }
  };

  await Promise.all(Array.from({ length: workers }, worker));

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  Done in ${totalSec}s — added ${filled} locations (${errors} errors)`);
  console.log(`  Total in DB: ~${alreadyInDb + filled}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
