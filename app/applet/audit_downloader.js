import fs from 'fs';

async function run() {
  const html = await (await fetch("https://smash-premier-league.lovable.app/")).text();
  const scriptMatches = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
  const linkMatches = [...html.matchAll(/href="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
  const allScripts = [...new Set([...scriptMatches, ...linkMatches])];
  console.log("Found scripts:", allScripts);

  for (const s of allScripts) {
    const text = await (await fetch("https://smash-premier-league.lovable.app" + s)).text();
    fs.writeFileSync(`temp_${s.split('/').pop()}`, text);
    console.log(`Saved ${s}, length: ${text.length}`);
  }
}
run();
