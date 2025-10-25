/**
 * Generate time-based greeting for users
 */
export function getGreeting(userName: string = 'Edgar'): string {
  const hour = new Date().getHours();
  
  if (hour < 12) {
    return `Good morning ${userName}, hope you're having a great start to your day`;
  } else if (hour < 17) {
    return `Good afternoon ${userName}, hope your day is going well`;
  } else {
    return `Hey ${userName}, hope you had a nice evening`;
  }
}
