/**
 * Fictional demo personas shown on the landing mockups, the /meera demo flow
 * and the dashboard. Single source of truth so every name always wears the
 * same face, everywhere it appears.
 * Portraits: Unsplash (each verified to resolve & visually checked).
 * fit=facearea keeps the face centred and legible even in the smallest avatars.
 */
const portrait = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=facearea&facepad=2.8&w=400&h=400&q=80`;

/* ---- creators ---- */
export const MEERA_AVATAR = portrait("1726156619056-5de67024df67");
export const MEERA_CREDENTIAL = "ex-Head of Talent, top e-commerce co";

export const VIKRAM_AVATAR = portrait("1594823825986-a3e022974919"); // fitness coach, Bengaluru
export const SNEHA_AVATAR = portrait("1590496467074-c4d437a179e7"); // maths tutor, Pune

/* the signed-in creator on the dashboard */
export const ABHISHEK_AVATAR = portrait("1589386417686-0d34b5903d23");

/* ---- clients ---- */
export const ROHIT_AVATAR = portrait("1757744705465-ea08b0ddc38a"); // Rohit Sharma
export const PRIYA_AVATAR = portrait("1758518729459-235dcaadc611"); // Priya Nair
export const ARJUN_AVATAR = portrait("1778692258270-bc0e80e975c0"); // Arjun Mehta
export const KAVYA_AVATAR = portrait("1768221677463-191fc4e15690"); // Kavya Reddy
export const ANANYA_AVATAR = portrait("1706943262459-3ef6ce03305c"); // Ananya S.
