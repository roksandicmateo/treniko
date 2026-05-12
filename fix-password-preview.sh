#!/bin/bash
[ ! -f "frontend/src/pages/Login.jsx" ] && echo "Pokreni iz korijena projekta" && exit 1

echo "Kreiranje PasswordInput komponente..."
cat > frontend/src/components/PasswordInput.jsx << 'EOF'
import { useState } from 'react';

export default function PasswordInput({ id, name, value, onChange, placeholder, required, autoFocus, className }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id} name={name} value={value} onChange={onChange}
        type={show ? 'text' : 'password'}
        required={required} autoFocus={autoFocus}
        placeholder={placeholder || '••••••••'}
        className={className || 'input pr-10'}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        tabIndex={-1}
        aria-label={show ? 'Sakrij lozinku' : 'Prikaži lozinku'}
      >
        {show ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}
EOF
echo "✓ PasswordInput.jsx kreiran"

python3 - <<'PYEOF'
files = [
    ('frontend/src/pages/Login.jsx', [
        (
            "import LanguageSelector from '../components/LanguageSelector';",
            "import LanguageSelector from '../components/LanguageSelector';\nimport PasswordInput from '../components/PasswordInput';"
        ),
        (
            '<input type="password" id="password" name="password" value={formData.password}\n              onChange={handleChange} required className="input" placeholder="••••••••" />',
            '<PasswordInput id="password" name="password" value={formData.password} onChange={handleChange} required />'
        ),
    ]),
    ('frontend/src/pages/Register.jsx', [
        (
            "import LanguageSelector from '../components/LanguageSelector';",
            "import LanguageSelector from '../components/LanguageSelector';\nimport PasswordInput from '../components/PasswordInput';"
        ),
        (
            '<input type="password" name="password" value={formData.password}\n              onChange={handleChange} required className="input" placeholder="••••••••" />',
            '<PasswordInput name="password" value={formData.password} onChange={handleChange} required />'
        ),
        (
            '<input type="password" name="confirmPassword" value={formData.confirmPassword}\n              onChange={handleChange} required className="input" placeholder="••••••••" />',
            '<PasswordInput name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />'
        ),
    ]),
    ('frontend/src/pages/ResetPasswordPage.jsx', [
        (
            "import { Link } from 'react-router-dom';",
            "import { Link } from 'react-router-dom';\nimport PasswordInput from '../components/PasswordInput';"
        ),
        (
            '<input type="password" value={password}\n                onChange={e => setPassword(e.target.value)}\n                required className="input" placeholder="••••••••" autoFocus />',
            '<PasswordInput value={password} onChange={e => setPassword(e.target.value)} required autoFocus />'
        ),
        (
            '<input type="password" value={confirm}\n                onChange={e => setConfirm(e.target.value)}\n                required className="input" placeholder="••••••••" />',
            '<PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} required />'
        ),
    ]),
]

for path, replacements in files:
    try:
        with open(path, 'r') as f:
            c = f.read()
        count = 0
        for old, new in replacements:
            if old in c:
                c = c.replace(old, new, 1)
                count += 1
        with open(path, 'w') as f:
            f.write(c)
        print(f"✓ {path.split('/')[-1]} — {count}/{len(replacements)} zamjena")
    except Exception as e:
        print(f"✗ {path}: {e}")
PYEOF
