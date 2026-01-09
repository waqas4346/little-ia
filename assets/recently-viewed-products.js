/**
 * Updates the recently viewed products in localStorage.
 */
export class RecentlyViewed {
  /** @static @constant {string} The key used to store the viewed products in session storage */
  static #STORAGE_KEY = 'viewedProducts';
  /** @static @constant {string} The key used to store the max products setting */
  static #MAX_PRODUCTS_KEY = 'viewedProductsMax';
  /** @static @constant {number} The default maximum number of products to store */
  static #DEFAULT_MAX_PRODUCTS = 4;

  /**
   * Gets the maximum number of products to store.
   * @returns {number} The maximum number of products.
   */
  static getMaxProducts() {
    const stored = localStorage.getItem(this.#MAX_PRODUCTS_KEY);
    return stored ? parseInt(stored, 10) : this.#DEFAULT_MAX_PRODUCTS;
  }

  /**
   * Sets the maximum number of products to store.
   * @param {number} maxProducts - The maximum number of products to store.
   */
  static setMaxProducts(maxProducts) {
    const max = Math.max(1, Math.min(50, parseInt(maxProducts, 10) || this.#DEFAULT_MAX_PRODUCTS));
    localStorage.setItem(this.#MAX_PRODUCTS_KEY, max.toString());
    // Trim existing products if needed
    const viewedProducts = this.getProducts();
    if (viewedProducts.length > max) {
      localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(viewedProducts.slice(0, max)));
    }
  }

  /**
   * Adds a product to the recently viewed products list.
   * @param {string} productId - The ID of the product to add.
   */
  static addProduct(productId) {
    let viewedProducts = this.getProducts();
    const maxProducts = this.getMaxProducts();

    viewedProducts = viewedProducts.filter((/** @type {string} */ id) => id !== productId);
    viewedProducts.unshift(productId);
    viewedProducts = viewedProducts.slice(0, maxProducts);

    localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(viewedProducts));
  }

  static clearProducts() {
    localStorage.removeItem(this.#STORAGE_KEY);
  }

  /**
   * Retrieves the list of recently viewed products from session storage.
   * @returns {string[]} The list of viewed products.
   */
  static getProducts() {
    return JSON.parse(localStorage.getItem(this.#STORAGE_KEY) || '[]');
  }
}
