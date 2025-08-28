// src/api/upRecipe.ts
import apiClient from '../apiClient.ts'; // Assuming apiClient is at src/apiClient.ts

export const deployUpRecipe = async () => {
  const res = await apiClient.post('/up-recipe/deploy');
  return res.data;
};