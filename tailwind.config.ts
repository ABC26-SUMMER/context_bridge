import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18211f",
        muted: "#65716d",
        line: "#d9ded8",
        surface: "#fbfaf6",
        bridge: "#116a67",
        "bridge-dark": "#0c4e4b",
        accent: "#e78b3c",
      },
      boxShadow: {},
    },
  },
  plugins: [],
} satisfies Config;
