# Medical Form Parser & Pediatric Growth Calculator

An elegant, full-stack, AI-powered application designed to streamline healthcare workflows by parsing handwritten clinical forms and automatically calculating pediatric growth percentiles.

The application leverages the state-of-the-art **Gemini 3.1 Flash Lite** model to extract patient records from uploaded images. It then computes precise height-for-age, weight-for-age, and MUAC (Mid-Upper Arm Circumference) z-scores and percentiles using standardized LMS datasets from the **World Health Organization (WHO)** and the **Centers for Disease Control and Prevention (CDC)**.

---

## Key Features

- **Handwritten Form Extraction**: Fully automated parsing of handwritten Spanish/English clinical data sheets using server-side Gemini multimodal capabilities.
- **Pediatric Percentile Calculation**: Core algorithmic calculation of z-scores and growth percentiles:
  - **WHO Growth Standards**: Applied automatically for pediatric patients aged 0 to 5 years (60 months).
  - **CDC Growth Charts**: Applied automatically for pediatric patients aged 5 to 20 years.
  - **Explanations**: Returns context and clear metrics explanations for pediatric patients.
- **Robust Image Processing & HEIC Support**: Handles modern mobile device photo formats (including `.heic` and `.heif` files) via high-performance backend-side image transcoding to JPEGs.
- **Real-Time Logs**: Features comprehensive, structured telemetry logs across both the frontend console and the backend terminal, allowing seamless tracking of ingestion, Gemini invocation, date standardizations, and percentile recalculations.
- **Export to CSV**: Generates clean, properly structured datasets compatible with standardized clinical campaign master sheets.

---

## Technical Architecture

- **Frontend**: Single-Page Application (SPA) built with **React**, **Vite**, **TypeScript**, and **Tailwind CSS v4**. Animations and transitions are powered by **Motion**.
- **Backend**: **Express** API gateway serving as a proxy to safeguard secrets (such as the Gemini API key), perform backend image transformations, run programmatic mathematical growth calculations, and host the client-side bundle.
- **AI Integration**: Implemented using the modern `@google/genai` SDK configured to query `gemini-3.1-flash-lite`.

---

## Prerequisites

- **Node.js**: Version 18 or higher is recommended.
- **Gemini API Key**: A valid Google Gemini API key is required to perform form OCR/parsing.

---

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the project root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

---

## Available Scripts

### Run the Development Server
Starts the Express server with `tsx` (TypeScript Executor). The server mounts Vite's dev middleware to handle asset bundling and HMR under a single port.
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

### Build the Application
Compiles the React frontend files into `dist/` and bundles the backend `server.ts` into a standalone, production-ready CommonJS file (`dist/server.cjs`) using `esbuild`.
```bash
npm run build
```

### Start in Production
Launches the compiled production server.
```bash
npm run start
```

### Run Linter
Runs static TypeScript type analysis across the codebase.
```bash
npm run lint
```

### Clean Build Artifacts
Removes generated build output and intermediate files.
```bash
npm run clean
```

---

## Growth Standards Used
- **CDC Growth Charts**: Grounded on LMS data curves derived from National Health and Nutrition Examination Survey (NHANES) measurements for kids aged 2 to 20 years.
- **WHO Growth Standards**: Grounded on international longitudinal datasets tracking healthy children raised under optimal environmental conditions from birth through age 5.
