const BACKEND_URL = 'http://localhost:8081';

export interface AnimeResult {
  success: boolean;
  animeImage?: string;
  error?: string;
}

export const animeService = {
  async animefyImage(imageData: string): Promise<AnimeResult> {
    try {
      const response = await fetch(`${BACKEND_URL}/anime-fy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to anime-fy image');
      }

      return await response.json();
    } catch (error) {
      console.error('Anime-fy error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to anime-fy image',
      };
    }
  },
};
