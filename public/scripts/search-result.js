window.addEventListener("load", async () => {
  const Clerk = window.Clerk;
  try {
    await Clerk.load();

    if (!Clerk.user) {
      window.location.href = './index_clerk.html';
      return;
    }

    initializeSearchResults();

  } catch (err) {
    console.error("Clerk failed to load on search results page:", err);
  }
});


function initializeSearchResults() {
  const resultsContainer = document.getElementById("results-container");
  const resultsSubtitle = document.querySelector(".results-subtitle");
  const verificationModal = document.getElementById("verification-modal");
  const verificationContent = document.getElementById("verification-content");
  const closeVerificationModal = document.querySelector(".close-verification-modal");

  let currentFoundItemId = null;

  const urlParams = new URLSearchParams(window.location.search);
  const lostItemId = urlParams.get('lostItemId');

  async function fetchAndRenderMatches(id) {
    try {
      const token = await window.Clerk.session.getToken();
      const response = await fetch(`https://reuniteai-production.up.railway.app/api/items/matches/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Could not fetch matches.');
      }
      const data = await response.json();
      renderSearchResults(data.matches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      resultsContainer.innerHTML = '<p class="no-matches-message">We couldn’t find any items that match currently. We will notify you if anything comes up.</p>';
    }
  }

  const renderSearchResults = (matches) => {
    resultsContainer.innerHTML = "";
    if (!matches || matches.length === 0) {
        resultsSubtitle.textContent = "We couldn't find any immediate matches for your item.";
        resultsContainer.innerHTML = `<div class="no-matches-message"><h3>No potential matches found.</h3><p>We've saved your report and will notify you of new matches.</p></div>`;
    } else {
        resultsSubtitle.textContent = `Based on your report, we found ${matches.length} potential match${matches.length > 1 ? "es" : ""}.`;
    }

    matches.forEach((item) => {
        const itemElement = document.createElement("div");
        itemElement.className = "item-card";
        const confidenceScore = Math.round((1 - item.distance) * 100);

        itemElement.innerHTML = `
            <img src="${item.image_url || 'https://placehold.co/224x224/eee/ccc?text=Image'}" alt="Photo of ${item.description}">
            <div class="item-desc">
                <p><strong>Description:</strong> ${item.description}</p>
                <p><strong>Location Found:</strong> ${item.location}</p>
                <p><strong>Date Found:</strong> ${new Date(item.item_date).toLocaleDateString()}</p>
                <p class="similarity-score">Match Confidence: <strong>${confidenceScore}%</strong></p>
                <button class="claim-button" data-found-id="${item.id}">Claim Item</button>
            </div>
        `;
        resultsContainer.appendChild(itemElement);
    });
    
    addClaimButtonListeners();
    
  };

  function addClaimButtonListeners() {
    document.querySelectorAll(".claim-button").forEach((button) => {
      button.addEventListener("click", (e) => {
        currentFoundItemId = e.target.dataset.foundId;
        startClaimProcess(currentFoundItemId);
      });
    });
  }

  async function startClaimProcess(foundItemId) {
    try {
      const token = await window.Clerk.session.getToken();
      const response = await fetch(
        "https://reuniteai-production.up.railway.app/api/items/claim/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ foundItemId: foundItemId }),
        }
      );
      if (!response.ok)
        throw new Error("Server error when starting claim process.");

      const data = await response.json();
      createVerificationModal(data.question);
    } catch (error) {
      console.error("Error starting claim process:", error);
      alert("Could not start the claim process. Please try again.");
    }
  }

  function createVerificationModal(question) {
    const isGenericQuestion = question.includes("unique details");
    verificationContent.innerHTML = `
            <h2 class="modal-title">${
              isGenericQuestion ? "Provide More Details" : "Prove It's Yours"
            }</h2>
            <p class="verification-question">${question}</p>
            <form id="verification-form">
                <textarea id="claimant-answer" placeholder="Your answer here..." required></textarea>${
                  isGenericQuestion
                    ? `
                    <label for="claimant-email">Your Student Email for Verification:</label>
                    <input type="email" id="claimant-email" placeholder="you@university.edu" required />
                `
                    : ""
                }
                <button type="submit" class="submit-button">Submit</button>
            </form>
        `;
    verificationModal.style.display = "flex";

    const form = verificationContent.querySelector("#verification-form");
    form.addEventListener("submit", handleVerificationSubmit);
  }

  async function handleVerificationSubmit(e) {
    e.preventDefault();
    const submitButton = e.target.querySelector(".submit-button");
    const claimantAnswerInput = e.target.querySelector("#claimant-answer");

    submitButton.disabled = true;
    submitButton.innerHTML =
      '<div class="loading-spinner" style="border-top-color: #0073e6;"></div>';

    const payload = {
      foundItemId: currentFoundItemId,
      lostItemId: lostItemId,
      claimantAnswer: claimantAnswerInput.value,
    };

    try {
        const token = await window.Clerk.session.getToken();
        const response = await fetch(
            "https://reuniteai-production.up.railway.app/api/items/claim/verify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
        });
      if (!response.ok) throw new Error("Verification request failed.");
      const result = await response.json();
      displayVerificationResult(result);
    } catch (error) {
      console.error("Error during verification:", error);
      alert("An error occurred during verification. Please try again.");
      submitButton.disabled = false;
      submitButton.textContent = "Submit";
    }
  }

  function displayVerificationResult(result) {
    if (result.verified) {
      verificationContent.innerHTML = `
                <div class="result-icon success"><i class="fas fa-check-circle"></i></div>
                <h2 class="modal-title">Claim Approved!</h2>
                <p>Your claim has been verified. Use the code below to pick up your item from campus security.</p>
                <div class="pickup-code-container">
                    <p>Your Unique Pickup Code:</p>
                    <div class="pickup-code" id="pickup-code-text">${result.pickupCode}</div>
                    <button class="copy-button" id="copy-code-btn">
                        <i class="fas fa-copy"></i> Copy Code
                    </button>
                </div>
                <a href="./index.html" class="back-button">Back to Home</a>
            `;

      document.getElementById("copy-code-btn").addEventListener("click", () => {
        const code = document.getElementById("pickup-code-text").innerText;
        copyToClipboard(code);
      });
    } else {
      verificationContent.innerHTML = `
                <div class="result-icon pending"><i class="fas fa-hourglass-half"></i></div>
                <h2 class="modal-title">Claim Pending Review</h2>
                <p>Thanks for the information. Your claim has been submitted for a quick manual review to ensure the item gets back to its rightful owner.</p>
                <p>You will receive an email update shortly.</p>
                <a href="./index.html" class="back-button" style="margin-top: 20px;">Back to Home</a>
            `;
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        const copyButton = document.getElementById("copy-code-btn");
        copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
          copyButton.innerHTML = '<i class="fas fa-copy"></i> Copy Code';
        }, 2000);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        const copyButton = document.getElementById("copy-code-btn");
        copyButton.textContent = "Copied!";
        setTimeout(() => {
          copyButton.textContent = "Copy Code";
        }, 2000);
      } catch (err) {
        console.error("Fallback copy failed", err);
      }
      document.body.removeChild(textArea);
    }
  }

  closeVerificationModal.onclick = () => {
    verificationModal.style.display = "none";
  };
  window.onclick = (event) => {
    if (event.target == verificationModal) {
      verificationModal.style.display = "none";
    }
  };
  
  if (lostItemId) {
    fetchAndRenderMatches(lostItemId);
  } else {
    resultsSubtitle.textContent = "There are no results to display.";
    resultsContainer.innerHTML =
      '<p class="no-matches-message">No search was performed. Please go back and report a lost item first.</p>';
  }
}
