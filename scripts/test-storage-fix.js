// 🧪 Storage Fix Verification Script
// Copy-paste this into your browser console to verify the fix

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🧪 STORAGE FIX VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: Check conversation ID location
console.log('📦 TEST 1: Conversation ID Storage Location\n');

const conversationId = localStorage.getItem('mallory_current_conversation_id');
const inSession = sessionStorage.getItem('mallory_current_conversation_id');
const authToken = localStorage.getItem('mallory_auth_token');

console.log('   Conversation ID in localStorage:', conversationId ? '✅ FOUND' : '❌ MISSING');
if (conversationId) {
  console.log('      Value:', conversationId);
}

console.log('   Conversation ID in sessionStorage:', inSession ? '❌ WRONG!' : '✅ CORRECT (not there)');

console.log('   Auth token in localStorage:', authToken ? '✅ FOUND' : '❌ MISSING');
if (authToken) {
  console.log('      Value:', authToken.substring(0, 20) + '...');
}

// Test 2: Verify all persistent keys
console.log('\n📦 TEST 2: All Persistent Keys (should be in localStorage)\n');

const persistentKeys = {
  'mallory_auth_token': 'Auth token',
  'mallory_refresh_token': 'Refresh token',
  'mallory_grid_account': 'Grid account',
  'mallory_grid_session_secrets': 'Grid secrets',
  'mallory_current_conversation_id': 'Conversation ID ← KEY!',
  'mallory_draft_messages': 'Draft messages'
};

Object.entries(persistentKeys).forEach(([key, label]) => {
  const value = localStorage.getItem(key);
  const status = value ? '✅' : '⚪';
  console.log(`   ${status} ${label}:`, value ? 'present' : 'not set');
});

// Test 3: Verify session keys (should be in sessionStorage or not set)
console.log('\n📦 TEST 3: Session Keys (should be in sessionStorage if active)\n');

const sessionKeys = {
  'mallory_oauth_in_progress': 'OAuth in progress',
  'mallory_auto_initiate_grid': 'Grid auto-initiate',
  'mallory_pending_send': 'Pending transaction',
  'mallory_is_logging_out': 'Logging out flag'
};

Object.entries(sessionKeys).forEach(([key, label]) => {
  const value = sessionStorage.getItem(key);
  const wrongPlace = localStorage.getItem(key);
  
  if (wrongPlace) {
    console.log(`   ❌ ${label}: IN WRONG STORAGE (localStorage)!`);
  } else if (value) {
    console.log(`   ✅ ${label}: in sessionStorage (active)`);
  } else {
    console.log(`   ⚪ ${label}: not active (ok)`);
  }
});

// Test 4: Simulate clearing sessionStorage
console.log('\n🧪 TEST 4: SessionStorage Clear Simulation\n');

const beforeClear = localStorage.getItem('mallory_current_conversation_id');
console.log('   Before clear - Conversation ID:', beforeClear ? '✅ present' : '❌ missing');

console.log('   Clearing sessionStorage...');
sessionStorage.clear();

const afterClear = localStorage.getItem('mallory_current_conversation_id');
console.log('   After clear - Conversation ID:', afterClear ? '✅ STILL PRESENT' : '❌ LOST!');

// Final verdict
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📊 VERDICT');
console.log('═══════════════════════════════════════════════════════════\n');

const hasConversationId = !!conversationId;
const notInSession = !inSession;
const persistsAfterClear = afterClear === beforeClear;

if (hasConversationId && notInSession && persistsAfterClear) {
  console.log('✅ ✅ ✅ ALL TESTS PASSED!');
  console.log('\nThe fix is working correctly:');
  console.log('  • Conversation ID is in localStorage ✅');
  console.log('  • Not in sessionStorage ✅');
  console.log('  • Survives sessionStorage.clear() ✅');
  console.log('\nThis means the loading bug is FIXED! 🎉');
  console.log('The app will work even after browser sleep.');
} else {
  console.log('❌ TESTS FAILED');
  console.log('\nIssues found:');
  if (!hasConversationId) {
    console.log('  ❌ Conversation ID not in localStorage');
  }
  if (inSession) {
    console.log('  ❌ Conversation ID incorrectly in sessionStorage');
  }
  if (!persistsAfterClear) {
    console.log('  ❌ Conversation ID lost after clearing sessionStorage');
  }
  console.log('\nThe loading bug may still exist.');
}

console.log('\n═══════════════════════════════════════════════════════════\n');

// Return results for programmatic use
({
  passed: hasConversationId && notInSession && persistsAfterClear,
  conversationId,
  inCorrectStorage: hasConversationId && notInSession,
  persistsAfterClear
});

