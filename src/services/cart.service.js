const httpStatus = require("http-status");
const { Cart, Product, User } = require("../models");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");

// TODO: CRIO_TASK_MODULE_CART - Implement the Cart service methods

/**
 * Fetches cart for a user
 * - Fetch user's cart from Mongo
 * - If cart doesn't exist, throw ApiError
 * --- status code  - 404 NOT FOUND
 * --- message - "User does not have a cart"
 *
 * @param {User} user
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const getCartByUser = async (user) => {
  let cart = await Cart.findOne({email:user.email});
  if(cart){
    return cart;
  }
  else{
    throw new ApiError(httpStatus.NOT_FOUND,'User does not have a cart');
  }
};

/**
 * Adds a new product to cart
 * - Get user's cart object using "Cart" model's findOne() method
 * --- If it doesn't exist, create one
 * --- If cart creation fails, throw ApiError with "500 Internal Server Error" status code
 *
 * - If product to add already in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product already in cart. Use the cart sidebar to update or remove product from cart"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - Otherwise, add product to user's cart
 *
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const addProductToCart = async (user, productId, quantity) => {
  //If Product is Present in database
  let product = await Product.findById(productId);
  if(product){
    let cart = await Cart.findOne({email:user.email});
    //If cart is present
    if(cart){
      let product = cart.cartItems.find((item)=>item.product.id === productId);
      //If Product already present in cart
      if(product){
        throw new ApiError(httpStatus.BAD_REQUEST,"Product already in cart. Use the cart sidebar to update or remove product from cart")
      }
      else{
        let newProduct = await Product.findById(productId);
        cart.cartItems.push({product:newProduct,quantity});
        let newCart = await Cart.create(cart);
        return newCart
      }
    }
    else{
      try {
        // let product = await Product.findById(productId);
        let cart = await Cart.create({email:user.email,cartItems:[{product,quantity}]});
        if(!cart) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR);
        return cart;
      } 
      catch (error) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR)
      }
    }

  }
  else{
    throw new ApiError(httpStatus.BAD_REQUEST,"Product doesn't exist in database")
  }
  
};

/**
 * Updates the quantity of an already existing product in cart
 * - Get user's cart object using "Cart" model's findOne() method
 * - If cart doesn't exist, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart. Use POST to create cart and add a product"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * - Otherwise, update the product's quantity in user's cart to the new quantity provided and return the cart object
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>
 * @throws {ApiError}
 */
const updateProductInCart = async (user, productId, quantity) => {
   //If Product is Present in database
   let product = await Product.findById(productId);
   if(product){
     let cart = await Cart.findOne({email:user.email});
     //If cart is present
     if(cart){
       let productIndex = cart.cartItems.findIndex((item)=>item.product.id === productId);
       if(productIndex >= 0){
        cart.cartItems[productIndex].quantity = quantity;
        let newCart = await cart.save();
        return newCart;
       }//Product not present
       else{
        throw new ApiError(httpStatus.BAD_REQUEST,"Product not in cart")
       }
     }
     else{
       throw new ApiError(httpStatus.BAD_REQUEST,"User does not have a cart. Use POST to create cart and add a product");
     }
 
   }
   else{
     throw new ApiError(httpStatus.BAD_REQUEST,"Product doesn't exist in database")
   }
   
};

/**
 * Deletes an already existing product in cart
 * - If cart doesn't exist for user, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * Otherwise, remove the product from user's cart
 *
 *
 * @param {User} user
 * @param {string} productId
 * @throws {ApiError}
 */
const deleteProductFromCart = async (user, productId) => {
  
    let cart = await Cart.findOne({email:user.email});
    if(cart){
      let productIndex = cart.cartItems.findIndex((item)=>item.product.id === productId);
      if(productIndex >= 0){
        let newCart = cart.cartItems.filter((item)=>item.product.id!==productId);
        cart.cartItems = newCart;
        await cart.save();
        return;

      }
      else{
        throw new ApiError(httpStatus.BAD_REQUEST,"Product not in cart");
      }
    }
    else{
      throw new ApiError(httpStatus.BAD_REQUEST,"User does not have a cart");
    }  
  

};



// TODO: CRIO_TASK_MODULE_TEST - Implement checkout function
/**
 * Checkout a users cart.
 * On success, users cart must have no products.
 *
 * @param {User} user
 * @returns {Promise}
 * @throws {ApiError} when cart is invalid
 */
const checkout = async (user) => {
  let cart = await getCartByUser(user);
  if(cart.cartItems.length===0){
    throw new ApiError(httpStatus.BAD_REQUEST)
  }
  if(!user.hasSetNonDefaultAddress()){
    throw new ApiError(httpStatus.BAD_REQUEST)
  }
  if(user.address === config.default_address){
    throw new ApiError(httpStatus.BAD_REQUEST)
  }
  
  let totalCost = cart.cartItems.reduce((total,item)=>{
    return total + (item.product.cost)*item.quantity
  },0)
  // console.log(totalCost);
  if(user.walletMoney < totalCost){
    throw new ApiError(httpStatus.BAD_REQUEST,'Wallet balance is insufficient')
  }
  user.walletMoney -= totalCost;
  cart.cartItems=[];
  // console.log(user);
  // console.log(cart);
  await cart.save();
  await user.save();

 
  return user;
 
};

module.exports = {
  getCartByUser,
  addProductToCart,
  updateProductInCart,
  deleteProductFromCart,
  checkout,
};
