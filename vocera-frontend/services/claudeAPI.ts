import Anthropic from '@anthropic-ai/sdk';

// Types for Claude API responses
export interface ClaudePhrase {
  passphrase: string;
  instructions: string;
}


class ClaudeAPI {
  private client: Anthropic;
  private apiKey: string;

  constructor() {
    // In production, store this securely in environment variables
    // For development, you'll need to add your Claude API key here
    this.apiKey = process.env.EXPO_PUBLIC_CLAUDE_API_KEY || 'your-claude-api-key-here';
    
    this.client = new Anthropic({
      apiKey: this.apiKey,
    });
  }

  // Generate a dynamic phrase for voice recording
  async generateDynamicPhrase(): Promise<ClaudePhrase> {
    try {
      // Check if API is properly configured
      console.log('Claude API key configured:', this.isConfigured());
      console.log('API key starts with:', this.apiKey.substring(0, 10) + '...');
      
      if (!this.isConfigured()) {
        console.warn('Claude API key not configured, using fallback phrase');
        return this.getFallbackPhrase();
      }

      const prompt = `Generate a grammatically correct six-word phrase that makes no semantic sense. The phrase should have a mismatched emotional tone — for example, a happy tone with a sad or dark sentence.

Respond in the following JSON format:
{  
  "passphrase": "your phrase here",  
  "instructions": "Say this in a [emotion] tone."  
}`;

      const message = await this.client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Parse the JSON response from Claude
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const parsedResponse: ClaudePhrase = JSON.parse(responseText);
      
      // Validate the response structure
      if (!parsedResponse.passphrase || !parsedResponse.instructions) {
        throw new Error('Invalid response format from Claude API');
      }

      return parsedResponse;
    } catch (error: any) {
      console.error('Error generating dynamic phrase:', error);
      console.error('Error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message
      });
      return this.getFallbackPhrase();
    }
  }

  // Get a fallback phrase when API is unavailable
  private getFallbackPhrase(): ClaudePhrase {
    const fallbackPhrases = [
      {
        passphrase: "Cheerful butterflies demolished Tuesday's melancholy expectations",
        instructions: "Say this in a cheerful tone."
      },
      {
        passphrase: "Sorrowful rainbows celebrated midnight's joyful disasters",
        instructions: "Say this in a sad tone."
      },
      {
        passphrase: "Angry puppies whispered gentle thunderstorm secrets",
        instructions: "Say this in an angry tone."
      }
    ];
    
    // Return a random fallback phrase
    const randomIndex = Math.floor(Math.random() * fallbackPhrases.length);
    return fallbackPhrases[randomIndex];
  }

  // Validate API key configuration
  isConfigured(): boolean {
    return this.apiKey !== 'your-claude-api-key-here' && this.apiKey.length > 0;
  }
}

export const claudeAPI = new ClaudeAPI();