# React Native Mobile App

This directory contains the React Native mobile application for the Stock Prediction platform.

## Setup

```bash
cd mobile
npm install
```

## Running the App

### iOS
```bash
npx react-native run-ios
```

### Android
```bash
npx react-native run-android
```

## Features

- Real-time stock price updates
- Portfolio management
- Technical indicators
- Price alerts
- News sentiment analysis
- Risk management tools

## Architecture

- **React Native**: Mobile framework
- **TypeScript**: Type safety
- **React Query**: Data fetching
- **React Navigation**: Navigation
- **Redux Toolkit**: State management
- **WebSocket**: Real-time data

## Components

- `src/screens/`: Main application screens
- `src/components/`: Reusable UI components
- `src/navigation/`: Navigation configuration
- `src/services/`: API and WebSocket services
- `src/store/`: Redux store configuration
- `src/utils/`: Utility functions

## Development

The mobile app shares business logic with the web application through a shared TypeScript library.
