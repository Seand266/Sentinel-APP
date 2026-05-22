const fs = require('fs');
const path = require('path');

// Read local .env file or fallback
const envPath = path.join(__dirname, '..', '.env');
let env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;
    const parts = trimmedLine.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

// Extract credentials
const apiKey = env.INDEX_FIREBASE_API_KEY || env.FIREBASE_API_KEY || "";
const emailjsKey = env.INDEX_EMAILJS_PUBLIC_KEY || env.EMAILJS_PUBLIC_KEY || "";

if (!apiKey) {
  console.warn("⚠️  WARNING: No INDEX_FIREBASE_API_KEY or FIREBASE_API_KEY found in your .env file!");
  console.warn("Please create a .env file in the project root with your credentials, e.g.:");
  console.warn("INDEX_FIREBASE_API_KEY=your_actual_api_key_here\n");
}

const filesToInject = ['index.html', 'admin.html', 'fetch_admin2.html', 'setup_test_accounts.html', 'test_email.html'];
const buildDir = path.join(__dirname, '..', 'local_build');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

filesToInject.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/{{INDEX_FIREBASE_API_KEY}}/g, apiKey)
                   .replace(/{{FIREBASE_API_KEY}}/g, apiKey)
                   .replace(/{{ADMIN_FIREBASE_API_KEY}}/g, apiKey)
                   .replace(/{{INDEX_EMAILJS_PUBLIC_KEY}}/g, emailjsKey)
                   .replace(/{{EMAILJS_PUBLIC_KEY}}/g, emailjsKey)
                   .replace(/{{ADMIN_EMAILJS_PUBLIC_KEY}}/g, emailjsKey);
  
  fs.writeFileSync(path.join(buildDir, file), content, 'utf8');
  console.log(`✅ Injected credentials into: local_build/${file}`);
});

// Copy assets to local_build
const assets = ['app.js', 'admin.js', 'encryption-service.js', 'style.css', 'sentinel-logo.png'];
assets.forEach(asset => {
  const src = path.join(__dirname, '..', asset);
  const dest = path.join(__dirname, '..', 'local_build', asset);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`   Copied asset: local_build/${asset}`);
  }
});

console.log('\n🚀 Local build completed successfully!');
console.log('You can now open local_build/index.html or local_build/admin.html safely in your browser.');
console.log('These files are automatically ignored by Git (via .gitignore) to prevent credential leaks.');
