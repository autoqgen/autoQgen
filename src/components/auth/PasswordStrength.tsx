"use client";

import { PASSWORD_MAX_LENGTH, PASSWORD_REQUIREMENTS } from "@/lib/auth/password";

function requirementMet(key: (typeof PASSWORD_REQUIREMENTS)[number]["key"], password: string) {
  switch (key) {
    case "length":
      return password.length >= 12 && password.length <= PASSWORD_MAX_LENGTH;
    case "lowercase":
      return /[a-z]/.test(password);
    case "uppercase":
      return /[A-Z]/.test(password);
    case "number":
      return /[0-9]/.test(password);
    case "special":
      return /[^A-Za-z0-9]/.test(password);
  }
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const met = PASSWORD_REQUIREMENTS.filter(({ key }) => requirementMet(key, password)).length;
  const strength = met <= 2 ? "Weak" : met === 3 || met === 4 ? "Fair" : "Strong";
  const color = met <= 2 ? "bg-red-500" : met <= 4 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">Password strength</span>
        <span className={met === 5 ? "font-semibold text-emerald-700" : "text-slate-600"}>
          {strength}
        </span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((segment) => (
          <span
            key={segment}
            className={`h-1.5 flex-1 rounded-full ${segment <= met ? color : "bg-slate-200"}`}
          />
        ))}
      </div>
      <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        {PASSWORD_REQUIREMENTS.map(({ key, label }) => (
          <li key={key} className={requirementMet(key, password) ? "text-emerald-700" : ""}>
            <span aria-hidden="true">{requirementMet(key, password) ? "✓" : "○"}</span>{" "}
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}