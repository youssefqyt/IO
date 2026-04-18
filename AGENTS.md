# ionic-app-base Information

## Summary
A mobile-first application built using the **Ionic Framework** with **Angular**. This project provides a base structure for building cross-platform applications with a focus on web technologies.

## Structure
- **src/**: Main source code directory.
  - **app/**: Core application logic, components, and pages.
    - **pages/**: Contains individual page components (home, login, settings, sign, start).
  - **assets/**: Static assets like images and icons.
  - **environments/**: Environment-specific configuration files.
  - **theme/**: Global styling and SCSS variables.
- **angular.json**: Angular CLI configuration for build and deployment.
- **ionic.config.json**: Ionic-specific project configuration.

## Language & Runtime
**Language**: TypeScript  
**Version**: ~5.9.0  
**Build System**: Angular CLI  
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- `@angular/core`: ^20.0.0
- `@ionic/angular`: ^8.0.0
- `ionicons`: ^7.0.0
- `rxjs`: ~7.8.0
- `zone.js`: ~0.15.0

**Development Dependencies**:
- `@angular/cli`: ^20.0.0
- `@angular-eslint/builder`: ^20.0.0
- `jasmine-core`: ~5.1.0
- `karma`: ~6.4.0
- `eslint`: ^9.16.0

## Build & Installation
```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Watch mode for development
npm run watch
```

## Testing

**Framework**: Karma & Jasmine
**Test Location**: `src/**/*.spec.ts`
**Naming Convention**: `*.spec.ts`
**Configuration**: `karma.conf.js`, `tsconfig.spec.json`

**Run Command**:
```bash
npm run test
```

## Validation
**Linter**: ESLint
**Lint Command**:
```bash
npm run lint
```