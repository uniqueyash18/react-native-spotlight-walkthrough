# Example

A parts-shop screen that walks through every feature of `react-native-spotlight-walkthrough`.

```sh
npm install
npm run ios       # or: npm run android (first run builds the native app)
npm start         # later runs: just start Metro
```

- The tour starts on launch. Tap **?** in the header to replay it.
- On step 4, tap the real car to continue. That's an interactive step.
- Switch the narration mode (`auto` / `audio` / `tts` / `off`) from the segmented control, even while the tour is running.

The app imports the library from `../src` through `metro.config.js`, so edits to the library hot-reload here. React, React Native and the other shared packages are always resolved from this folder's `node_modules`, so the app never loads two copies of React.

`EXPO_PUBLIC_AUTOPLAY=1 npm start` steps through the tour on a timer. That's how the README screenshots were recorded.
