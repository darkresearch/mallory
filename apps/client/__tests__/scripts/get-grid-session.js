/**
 * Helper script to extract Grid session data from browser localStorage
 *
 * Run this in the browser console (F12) when signed into the app:
 *
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. It will output the Grid session data you need
 *
 * Then set these as environment variables:
 * export TEST_GRID_ACCOUNT='<output from gridAccount>'
 * export TEST_GRID_SESSION_SECRETS='<output from sessionSecrets>'
 */

(async () => {
  try {
    const gridAccountKey = "mallory_grid_account";
    const gridSecretsKey = "mallory_grid_session_secrets";

    const gridAccount = localStorage.getItem(gridAccountKey);
    const sessionSecrets = localStorage.getItem(gridSecretsKey);

    if (!gridAccount || !sessionSecrets) {
      console.error("❌ Grid session not found in localStorage");
      console.log(
        "Make sure you are signed into the app with your Grid wallet"
      );
      return;
    }

    const account = JSON.parse(gridAccount);

    console.log("✅ Grid session found!");
    console.log("");
    console.log("Wallet address:", account.address);
    console.log("");
    console.log("📋 Copy these to set as environment variables:");
    console.log("");
    console.log(
      "export TEST_GRID_ACCOUNT=" + JSON.stringify(JSON.stringify(gridAccount))
    );
    console.log(
      "export TEST_GRID_SESSION_SECRETS=" +
        JSON.stringify(JSON.stringify(sessionSecrets))
    );
    console.log("");
    console.log("Or for Windows PowerShell:");
    console.log(
      '$env:TEST_GRID_ACCOUNT="' + gridAccount.replace(/"/g, '\\"') + '"'
    );
    console.log(
      '$env:TEST_GRID_SESSION_SECRETS="' +
        sessionSecrets.replace(/"/g, '\\"') +
        '"'
    );

    // Also output as JSON for easy copying
    console.log("");
    console.log("📋 Or copy this JSON:");
    console.log(
      JSON.stringify(
        {
          TEST_GRID_ACCOUNT: gridAccount,
          TEST_GRID_SESSION_SECRETS: sessionSecrets,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("❌ Error extracting Grid session:", error);
  }
})();
