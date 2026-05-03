import express from "express";
import { deleteUser, getOneUser, getUserById, getUsers, updateUser } from "../controllers/user.controller.js";

const router = express.Router();

//负责用户管理的路由与 user controller中方法的绑定

router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.get("/getOneUser", getOneUser);
router.delete("/users/:id", deleteUser);
router.put("/users/:id", updateUser);

export default router;
