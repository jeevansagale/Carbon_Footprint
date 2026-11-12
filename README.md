# Carbon Footprint — EcoTrack AI

A team-built carbon-footprint assessment project that estimates lifestyle-related emissions and presents category-level insights, historical comparisons, and sustainability guidance.

**Live demo:** https://carbon-footprint-smoky.vercel.app/

> This project was developed as a Software Engineering mini project. Some features and datasets are project-specific; review the data-source notes and implementation before treating an estimate as a measured personal footprint.

## Overview

The application guides users through an assessment covering areas such as transportation, household energy, food, waste, and shopping. It calculates estimated emissions using category-specific factors and presents the results through a dashboard.

The repository also contains an AI-assisted sustainability guidance feature and what-if exploration tools.

## Main Features

- Adaptive lifestyle assessment.
- Category-based CO₂-equivalent estimates.
- Regional electricity emission factors for India.
- Transportation and household-energy estimates.
- Category breakdown and historical assessment views.
- What-if comparisons and sustainability recommendations.
- PDF assessment reports.
- Data-provider abstractions and source metadata.

## Data and Calculation Notes

The calculation engine uses emission factors and datasets referenced in the project. The resulting footprint is an estimate based on user inputs and the assumptions encoded in the application.

Before relying on a result, inspect the source attribution, geographic coverage, units, and update date of the relevant factor. A dashboard confidence score should not be interpreted as an independently validated statistical confidence interval unless the underlying method establishes that.

The repository also contains demonstration and mock-data paths. AI-generated guidance is advisory and should not be confused with measured emissions or verified environmental outcomes.

## Architecture

```text
Assessment Inputs
       |
       v
Validation and Normalization
       |
       v
Emission Calculation Engine
       |
       +------> Dataset / Factor Metadata
       |
       v
Assessment Results
       |
       +------> Category Breakdown
       +------> Historical Views
       +------> What-if Exploration
       +------> AI-assisted Guidance
       +------> PDF Report
```

## Screenshots

The repository currently does not contain a curated set of application screenshots in its root documentation. Add current screenshots here when available rather than embedding unrelated assets.

## Run Locally

### Requirements

- Node.js version compatible with the project's Vite toolchain.
- npm.
- Firebase project configuration for features that require Firebase services.

### Setup

```bash
git clone https://github.com/jeevansagale/Carbon_Footprint.git
cd Carbon_Footprint
npm install
```

Create a local `.env` file using the variable names documented in `.env.example`. Do not commit real API keys, Firebase credentials, or other secrets.

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run tests:

```bash
npm test -- --run
```

## Project Contributors

This was developed as a team project. Retain the contributor list and attribution from the project submission materials when preparing a public release.

## License

No root-level license file is currently included. Third-party artwork and other external assets may have separate terms. Do not assume the repository grants permission to reuse all included material.
