import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "../../Styles/Operator's_CSS/Franchise.css"; 

const Sidebar = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const { user, logout } = useAuth();
	
	// Define menu items with role-based access
	const menuItems = useMemo(() => {
		const items = [
			{ name: 'HOME', path: '/operator/franchise', allowedRoles: ['user', 'operator'] },
			{ name: 'MY FRANCHISE', path: '/operator/franchise', allowedRoles: ['user', 'operator'] },
			{ name: 'FRANCHISEE LIST', path: '/operator/franchisee-list', allowedRoles: ['user', 'operator'] }
		];
		
		// Filter based on user role
		if (!user?.role) return [];
		return items.filter(item => item.allowedRoles.includes(user.role));
	}, [user]);
	
	const userName = useMemo(() => {
		if (!user) return 'USER';
		if (user?.firstName) return user.firstName.toUpperCase();
		if (user?.name) return user.name.split(' ')[0].toUpperCase();
		return 'USER';
	}, [user]);
	
	const isActivePath = (path) => {
		return location.pathname === path;
	};
	
	const handleLogout = async () => {
		await logout();
		navigate('/login');
	};
	
	return (
		<nav style={{
			background: "#0a3970",
			padding: "20px 0",
			display: "flex",
			justifyContent: "center"
		}}>
			<div style={{
				background: "#fff",
				borderRadius: "25px",
				display: "flex",
				alignItems: "center",
				padding: "5px 15px"
			}}>
				{menuItems.map((item) => (
					<Link 
						key={item.name}
						to={item.path} 
						style={{
							textDecoration: "none",
							color: isActivePath(item.path) ? "#0a3970" : "#000",
							fontWeight: isActivePath(item.path) ? 700 : 600,
							margin: "0 18px",
							fontFamily: "Poppins, sans-serif",
							borderBottom: isActivePath(item.path) ? "2px solid #0a3970" : "none",
							paddingBottom: "4px"
						}}
					>
						{item.name}
					</Link>
				))}
				<div 
					style={{
						marginLeft: "18px",
						background: "#0a3970",
						color: "#fff",
						borderRadius: "18px",
						padding: "6px 18px",
						display: "flex",
						alignItems: "center",
						fontWeight: 600,
						fontFamily: "Poppins, sans-serif",
						cursor: "pointer"
					}}
					onClick={handleLogout}
					title="Click to logout"
				>
					<span style={{ marginRight: "8px", fontSize: "18px", fontFamily: "Poppins, sans-serif" }}>👤</span>
					{userName}
				</div>
			</div>
		</nav>
	);
};

export default Sidebar;
