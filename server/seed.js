// Starter data, loaded the first time the server starts against an empty products table.
// `stock` is today's batch size; the demo has no daily reset.
export const PRODUCTS = [
  { id: 'sourdough-loaf', name: 'Country Sourdough', category: 'Breads', emoji: '🍞', price: 8.5, stock: 30, description: 'Slow-fermented for 36 hours, crackly crust and a soft, tangy crumb.' },
  { id: 'baguette', name: 'Classic Baguette', category: 'Breads', emoji: '🥖', price: 4.25, stock: 40, description: 'Crisp outside, airy inside. Best eaten the day it is baked.' },
  { id: 'multigrain', name: 'Seeded Multigrain Loaf', category: 'Breads', emoji: '🌾', price: 7.75, stock: 25, description: 'Oats, flax, sunflower and pumpkin seeds in a honey-sweetened dough.' },
  { id: 'croissant', name: 'Butter Croissant', category: 'Pastries', emoji: '🥐', price: 3.75, stock: 60, description: 'Laminated with French butter, 27 flaky layers.' },
  { id: 'pain-au-chocolat', name: 'Pain au Chocolat', category: 'Pastries', emoji: '🍫', price: 4.25, stock: 48, description: 'Croissant dough wrapped around two bars of dark chocolate.' },
  { id: 'cinnamon-roll', name: 'Cinnamon Roll', category: 'Pastries', emoji: '🌀', price: 4.5, stock: 36, description: 'Gooey cinnamon swirl with cream cheese glaze.' },
  { id: 'fruit-danish', name: 'Seasonal Fruit Danish', category: 'Pastries', emoji: '🍑', price: 4.75, stock: 24, description: 'Custard and whatever fruit is best this week.' },
  { id: 'choc-cake', name: 'Triple Chocolate Cake', category: 'Cakes', emoji: '🍰', price: 38, stock: 10, description: '8-inch, three layers of chocolate sponge and ganache. Serves 8-10.' },
  { id: 'lemon-cake', name: 'Lemon Drizzle Cake', category: 'Cakes', emoji: '🍋', price: 28, stock: 12, description: 'Moist lemon sponge with a sharp, sugary glaze. Serves 8.' },
  { id: 'carrot-cake', name: 'Carrot Cake', category: 'Cakes', emoji: '🥕', price: 34, stock: 8, description: 'Spiced, walnut-studded layers with cream cheese frosting. Serves 8-10.' },
  { id: 'cupcakes-six', name: 'Cupcake Box (6)', category: 'Cakes', emoji: '🧁', price: 18, stock: 20, description: 'Assorted vanilla, chocolate and red velvet with buttercream.' },
  { id: 'choc-chip-cookie', name: 'Chocolate Chip Cookie', category: 'Cookies', emoji: '🍪', price: 2.75, stock: 80, description: 'Brown butter dough, sea salt, big dark chocolate chunks.' },
  { id: 'macarons-box', name: 'Macaron Box (8)', category: 'Cookies', emoji: '🌈', price: 22, stock: 14, description: 'Pistachio, raspberry, salted caramel and vanilla bean.' },
  { id: 'apple-pie', name: 'Dutch Apple Pie', category: 'Pies & Savory', emoji: '🥧', price: 26, stock: 9, description: 'Tart apples under a cinnamon crumble. Serves 8.' },
  { id: 'quiche', name: 'Spinach & Feta Quiche', category: 'Pies & Savory', emoji: '🥬', price: 19, stock: 6, description: 'Buttery crust, eggs, spinach and tangy feta. Serves 4-6. Limited daily batch.' },
  { id: 'sausage-roll', name: 'Sausage Roll', category: 'Pies & Savory', emoji: '🌭', price: 4.5, stock: 0, description: 'Flaky pastry around herby pork. Sold out today.' },
];
