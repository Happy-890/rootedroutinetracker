/** Remove only the host's promotional badge, including delayed reinsertion. */
export function removeHostBadge() {
  const remove = () => document.getElementById("lovable-badge")?.remove();
  remove();
  // The host inserts its badge directly under body. Do not observe app subtrees.
  const observer = new MutationObserver(remove);
  observer.observe(document.body, { childList: true });
  return () => observer.disconnect();
}
