from typing import List, Optional, Dict, Any
import math
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Request
from sqlalchemy.ext.asyncio import AsyncSession

from config.get_db import get_db
from module_admin.aspect.interface_auth import CheckUserInterfaceAuth
from module_admin.service.login_service import LoginService
from module_admin.entity.vo.user_vo import CurrentUserModel
from module_h5.entity.vo.user_vo import (
    H5UserPageQueryModel, H5UserModel, H5UserDetailModel,
    ChangeH5UserStatusModel, DeleteH5UserModel
)
from module_h5.service.user_service import H5UserService
from utils.page_util import PageResponseModel
from utils.response_util import ResponseUtil

userController = APIRouter(
    prefix="/h5/user",
    tags=["H5用户管理"],
    dependencies=[Depends(LoginService.get_current_user)]
)


@userController.get("/list", response_model=PageResponseModel, summary="获取用户列表")
async def get_user_list(
    query: H5UserPageQueryModel = H5UserPageQueryModel.as_query(),
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:list")),
    db: AsyncSession = Depends(get_db)
):
    """获取用户列表"""
    users, total = await H5UserService.get_user_list(query, db)
    page_info = PageResponseModel(
        rows=users,
        page_num=query.page_num,
        page_size=query.page_size,
        total=total,
        has_next=True if math.ceil(total / query.page_size) > query.page_num else False
    )
    return ResponseUtil.success(data=page_info)


@userController.get("/{user_id}", summary="获取用户详情")
async def get_user_detail(
    user_id: str = Path(..., description="用户ID"),
    request: Request = None,
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:query")),
    db: AsyncSession = Depends(get_db)
):
    """获取用户详情"""
    user = await H5UserService.get_user_detail(user_id, db, request)
    if not user:
        return ResponseUtil.error("用户不存在")
    return ResponseUtil.success(data=user)


@userController.post("/add", summary="创建用户")
async def create_user(
    user: H5UserModel,
    request: Request,
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:add")),
    db: AsyncSession = Depends(get_db)
):
    """创建用户"""
    try:
        print(f"收到创建用户请求，用户数据: {user.dict()}")
        print(f"请求头信息: {request.headers}")
        print(f"客户端IP: {request.client.host}")
        print(f"X-Forwarded-For: {request.headers.get('X-Forwarded-For')}")
        
        new_user = await H5UserService.create_user(user, request, db)
        print(f"创建用户成功，用户ID: {new_user.user_id}, 登录IP: {new_user.login_ip}")
        return ResponseUtil.success(data=new_user)
    except HTTPException as e:
        print(f"创建用户失败，错误: {e.detail}")
        return ResponseUtil.error(e.detail)
    except Exception as e:
        print(f"创建用户失败，异常: {str(e)}")
        return ResponseUtil.error(f"创建用户失败: {str(e)}")


@userController.put("/edit/{user_id}", summary="更新用户")
async def update_user(
    user_id: str = Path(..., description="用户ID"),
    user: H5UserModel = None,
    request: Request = None,
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:edit")),
    db: AsyncSession = Depends(get_db)
):
    """更新用户"""
    print(f"收到更新用户请求，用户ID: {user_id}, 数据: {user.dict() if user else None}")
    
    # 强制删除用户名属性，确保不会进行用户名检查
    if hasattr(user, "username"):
        print(f"删除用户名属性: {user.username}")
        delattr(user, "username")
    
    updated_user = await H5UserService.update_user(user_id, user, request, db)
    if not updated_user:
        print(f"用户不存在: {user_id}")
        return ResponseUtil.error("用户不存在")
    
    print(f"用户更新成功: {user_id}")
    return ResponseUtil.success(data=updated_user)


@userController.delete("/{user_id}", summary="删除用户")
async def delete_user(
    user_id: str = Path(..., description="用户ID"),
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:remove")),
    db: AsyncSession = Depends(get_db)
):
    """删除用户"""
    result = await H5UserService.delete_user(user_id, db)
    if not result:
        return ResponseUtil.error("用户不存在")
    return ResponseUtil.success(data=True)


@userController.put("/status/change", summary="修改用户状态")
async def change_user_status(
    status_model: ChangeH5UserStatusModel,
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:edit")),
    db: AsyncSession = Depends(get_db)
):
    """修改用户状态"""
    result = await H5UserService.change_user_status(status_model.user_id, status_model.status, db)
    if not result:
        return ResponseUtil.error("用户不存在")
    return ResponseUtil.success(data=True)


@userController.post("/checkin/{user_id}", summary="用户签到")
async def user_checkin(
    user_id: str = Path(..., description="用户ID"),
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:checkin")),
    db: AsyncSession = Depends(get_db)
):
    """用户签到"""
    try:
        result = await H5UserService.user_checkin(user_id, db)
        return ResponseUtil.success(data=result)
    except HTTPException as e:
        return ResponseUtil.error(e.detail)


@userController.post("/mood/{user_id}", summary="发布心情")
async def create_mood(
    user_id: str = Path(..., description="用户ID"),
    content: str = Query(..., description="心情内容"),
    status: str = Query("0", description="状态（0公开 1私有）"),
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:mood")),
    db: AsyncSession = Depends(get_db)
):
    """发布心情"""
    try:
        result = await H5UserService.create_user_mood(user_id, content, status, db)
        return ResponseUtil.success(data=result)
    except HTTPException as e:
        return ResponseUtil.error(e.detail)


@userController.get("/mood/list", response_model=PageResponseModel, summary="获取心情列表")
async def get_mood_list(
    user_id: Optional[str] = Query(None, description="用户ID"),
    status: Optional[str] = Query(None, description="状态（0公开 1私有）"),
    page_num: int = Query(1, description="页码"),
    page_size: int = Query(10, description="每页条数"),
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:mood:list")),
    db: AsyncSession = Depends(get_db)
):
    """获取心情列表"""
    moods, total = await H5UserService.get_user_moods(user_id, page_num, page_size, status, db)
    page_info = PageResponseModel(
        rows=moods,
        page_num=page_num,
        page_size=page_size,
        total=total,
        has_next=True if math.ceil(total / page_size) > page_num else False
    )
    return ResponseUtil.success(data=page_info)


@userController.put("/mood/{user_id}", summary="更新用户心情")
async def update_user_mood(
    user_id: str = Path(..., description="用户ID"),
    mood: str = Query(..., description="心情内容"),
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:mood:edit")),
    db: AsyncSession = Depends(get_db)
):
    """更新用户心情"""
    try:
        result = await H5UserService.update_user_mood(user_id, mood, db)
        return ResponseUtil.success(data=result)
    except HTTPException as e:
        return ResponseUtil.error(e.detail)


@userController.post("/payment/{user_id}", summary="创建支付订单")
async def create_payment(
    user_id: str = Path(..., description="用户ID"),
    amount: int = Query(..., description="支付金额（分）"),
    pay_type: str = Query(..., description="支付类型"),
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:payment")),
    db: AsyncSession = Depends(get_db)
):
    """创建支付订单"""
    try:
        result = await H5UserService.create_payment_order(user_id, amount, pay_type, db)
        return ResponseUtil.success(data=result)
    except HTTPException as e:
        return ResponseUtil.error(e.detail)


@userController.get("/payment/{order_no}", summary="查询支付状态")
async def check_payment_status(
    order_no: str = Path(..., description="订单号"),
    current_user: CurrentUserModel = Depends(CheckUserInterfaceAuth("h5:user:payment:query")),
    db: AsyncSession = Depends(get_db)
):
    """查询支付状态"""
    try:
        result = await H5UserService.check_payment_status(order_no, db)
        return ResponseUtil.success(data=result)
    except HTTPException as e:
        return ResponseUtil.error(e.detail)


@userController.get("/code/{uuid}", summary="获取验证码")
async def get_verify_code(
    uuid: str = Path(..., description="唯一标识")
):
    """获取验证码"""
    result = await H5UserService.generate_verify_code(uuid)
    return ResponseUtil.success(data=result)


@userController.post("/email/code", summary="发送邮箱验证码")
async def send_email_code(
    email: str = Query(..., description="邮箱地址")
):
    """发送邮箱验证码"""
    result = await H5UserService.send_email_code(email)
    return ResponseUtil.success(data=result)
