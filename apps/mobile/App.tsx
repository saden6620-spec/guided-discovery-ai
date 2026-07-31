/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <Text style={styles.title}>Guided Discovery AI</Text>
      <Text style={styles.subtitle}>Platform skeleton</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
});
