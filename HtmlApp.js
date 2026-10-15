import { useEffect, useState } from 'react';
import { useAssets } from 'expo-asset';
import { File } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const API_ORIGIN = 'https://prueva-1-wuwk.onrender.com/';

export default function HtmlApp() {
  const [assets, error] = useAssets([require('./index.html')]);
  const htmlUri = assets?.[0]?.localUri;
  const [html, setHtml] = useState(null);
  const [readError, setReadError] = useState(null);

  useEffect(() => {
    if (!htmlUri) return undefined;

    let cancelled = false;
    new File(htmlUri).text().then(
      (content) => {
        if (!cancelled) setHtml(content);
      },
      (loadError) => {
        if (!cancelled) {
          setReadError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [htmlUri]);

  if (error || readError) {
    return (
      <View style={styles.message}>
        <Text style={styles.error}>
          No se pudo cargar index.html: {error?.message || readError}
        </Text>
      </View>
    );
  }

  if (!htmlUri || !html) {
    return (
      <View style={styles.message}>
        <ActivityIndicator color="#750d32" />
        <Text style={styles.loading}>Cargando la aplicación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: API_ORIGIN }}
        style={styles.webView}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f2ef',
  },
  webView: {
    flex: 1,
    backgroundColor: '#f5f2ef',
  },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f2ef',
  },
  loading: {
    marginTop: 12,
    color: '#292421',
  },
  error: {
    color: '#a63338',
    textAlign: 'center',
  },
});
