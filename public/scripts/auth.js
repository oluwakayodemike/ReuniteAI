import { initializeNotificationDropdown } from './notifications.js';

let notificationsInitialized = false;

window.addEventListener("load", async function () {
  const Clerk = window.Clerk;

  try {
    await Clerk.load();
    console.log("clerk is loaded and ready!");

    const userButtonDiv = document.getElementById("user-button");
    const signedInNav = document.getElementById("signed-in-nav");
    const signedOutNav = document.getElementById("signed-out-nav");
    const loginButton = document.getElementById("login-button");
    const signupButton = document.getElementById("signup-button");

    function updateNav() {
      if (Clerk.user) {
        signedOutNav.style.display = "none";
        signedInNav.style.display = "flex";
        if (userButtonDiv && !userButtonDiv.hasChildNodes()) {
          Clerk.mountUserButton(userButtonDiv);
        }
        if (!notificationsInitialized) {
          initializeNotificationDropdown(Clerk);
          notificationsInitialized = true;
        }
      } else {
        signedInNav.style.display = "none";
        signedOutNav.style.display = "flex";
        notificationsInitialized = false;
      }
    }

    updateNav();

    Clerk.addListener(() => {
      console.log("Auth state changed, updating UI");
      updateNav();
    });

    if (loginButton) {
      loginButton.addEventListener("click", (e) => {
        e.preventDefault();
        Clerk.openSignIn();
      });
    }
    if (signupButton) {
      signupButton.addEventListener("click", (e) => {
        e.preventDefault();
        Clerk.openSignUp();
      });
    }
  } catch (err) {
    console.error("Clerk failed to load", err);
  }
});
