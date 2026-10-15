import { buildComponentTopologyArtifacts } from './vendor/3d-converters/topology-browser-core.mjs';
import fs from 'fs';
import path from 'path';

async function test() {
  try {
    const textA = fs.readFileSync('Benchmarks/1885Sjson/Sjson.json', 'utf8');
    const artifacts = await buildComponentTopologyArtifacts(textA, { sourceName: 'baseline', toleranceMm: 6 });
    console.log("Artifact keys:", Object.keys(artifacts));
    const topoA = artifacts.canonicalTopology;
    if (topoA) {
      console.log("TopoA keys:", Object.keys(topoA));
      console.log("TopoA edges type:", typeof topoA.edges);
      console.log("TopoA edges length:", topoA.edges?.length);
    } else {
      console.log("canonicalTopology is undefined!");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
