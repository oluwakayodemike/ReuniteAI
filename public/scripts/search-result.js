document.addEventListener('DOMContentLoaded', () => {
    const resultsContainer = document.getElementById('results-container');
    const resultsSubtitle = document.querySelector('.results-subtitle');
    const storedResults = sessionStorage.getItem('searchResults');

    if (storedResults) {
        const matches = JSON.parse(storedResults);
        resultsContainer.innerHTML = '';

        if (matches.length === 0) {
            resultsSubtitle.textContent = "We couldn't find any immediate matches for your item.";
            resultsContainer.innerHTML = `
                <div class="no-matches-message">
                    <h3>No potential matches found at this time.</h3>
                    <p>We've saved your 'lost' item report. We will automatically search for new 'found' items and notify you if a match appears.</p>
                </div>
            `;
        } else if (matches.length === 1) {
            resultsSubtitle.textContent = "Based on your report, we found one potential match. If you think it's yours, click \"Claim Item\" to start the verification process.";
        } else {
            resultsSubtitle.textContent = `Based on your report, we found ${matches.length} potential matches. If you see yours, click "Claim Item" to start the verification process.`;
        }

        matches.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'item-card';

            const itemDate = item.item_date ? new Date(item.item_date).toLocaleDateString() : 'N/A';
            const imageUrl = item.image_url || 'https://placehold.co/224x224/eee/ccc?text=Image+Not+Available';
            const confidenceScore = Math.round((1 - item.distance) * 100);

            itemElement.innerHTML = `
                <img src="${imageUrl}" alt="Photo of ${item.description || 'found item'}">
                <div class="item-desc">
                    <p><strong>Description:</strong> ${item.description || 'No description provided.'}</p>
                    <p><strong>Location Found:</strong> ${item.location || 'No location provided.'}</p>
                    <p><strong>Date Found:</strong> ${itemDate}</p>
                    <p class="similarity-score">Match Confidence: ${confidenceScore}%</p>
                    <button class="claim-button">Claim Item</button>
                </div>
            `;
            resultsContainer.appendChild(itemElement);
        });
        
        sessionStorage.removeItem('searchResults');
    } else {
        resultsSubtitle.textContent = "There are no results to display.";
        resultsContainer.innerHTML = '<p class="no-matches-message">No search was performed. Please go back and report a lost item first.</p>';
    }
});
