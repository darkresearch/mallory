import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';

interface SearchResult {
  title: string;
  url: string;
  content?: string;
  publishedDate?: string;
}

interface ChainOfThoughtSearchResultsProps {
  results: SearchResult[];
  style?: any;
}

/**
 * ChainOfThoughtSearchResults - Display search results in Chain of Thought
 * Mirrors Vercel's ChainOfThoughtSearchResults for React Native
 */
export const ChainOfThoughtSearchResults: React.FC<ChainOfThoughtSearchResultsProps> = ({
  results,
  style,
}) => {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {results.slice(0, 5).map((result, index) => (
          <ChainOfThoughtSearchResult
            key={index}
            title={result.title}
            url={result.url}
          />
        ))}
        {results.length > 5 && (
          <View style={styles.moreResults}>
            <Text style={styles.moreText}>+{results.length - 5} more</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

interface ChainOfThoughtSearchResultProps {
  title: string;
  url: string;
}

/**
 * ChainOfThoughtSearchResult - Individual search result badge
 * Mirrors Vercel's ChainOfThoughtSearchResult for React Native
 */
export const ChainOfThoughtSearchResult: React.FC<ChainOfThoughtSearchResultProps> = ({
  title,
  url,
}) => {
  const domain = extractDomain(url);
  const shortTitle = title.length > 40 ? title.substring(0, 40) + '...' : title;

  const handlePress = async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.warn('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.resultBadge} 
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={`Open ${title} from ${domain}`}
    >
      <Text style={styles.resultTitle}>{shortTitle}</Text>
      <Text style={styles.resultDomain}>{domain}</Text>
    </TouchableOpacity>
  );
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  scrollContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  resultBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: 200,
    // Add subtle interaction feedback
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  resultTitle: {
    fontSize: 11,
    color: '#DCE9FF',
    fontWeight: '500',
    marginBottom: 2,
  },
  resultDomain: {
    fontSize: 10,
    color: '#DCE9FF',
    opacity: 0.6,
  },
  moreResults: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 11,
    color: '#DCE9FF',
    opacity: 0.7,
  },
});

export default ChainOfThoughtSearchResults;
