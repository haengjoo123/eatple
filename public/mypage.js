
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/stats/my');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();

        if (result.success && result.serviceUsage) {
            const { serviceUsage } = result;
            
            // fallback to 0 if a key is missing
            const getStat = (key) => serviceUsage[key] || 0;

            document.getElementById('nutritionSearchCount').textContent = getStat('ingredientAnalysis');
            document.getElementById('savedMealsStatCount').textContent = getStat('mealPlan');
            document.getElementById('savedSupplementsStatCount').textContent = getStat('supplementRecommendation');
            document.getElementById('miniGamePlays').textContent = getStat('mini-game');
        } else {
            console.error('Failed to get stats:', result.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error fetching my stats:', error);
        // Optionally, update UI to show an error state
        document.getElementById('nutritionSearchCount').textContent = 'N/A';
        document.getElementById('savedMealsStatCount').textContent = 'N/A';
        document.getElementById('savedSupplementsStatCount').textContent = 'N/A';
        document.getElementById('miniGamePlays').textContent = 'N/A';
    }
});
