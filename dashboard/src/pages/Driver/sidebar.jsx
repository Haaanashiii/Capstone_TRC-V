import React from "react";
import { Link } from "react-router-dom";
import "../../Styles/Operator's_CSS/Franchise.css"; 

const Sidebar = () => {
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
				<Link to="/operator/home" style={{
					textDecoration: "none",
					color: "#000",
					fontWeight: 600,
					margin: "0 18px",
					fontFamily: "Poppins, sans-serif"
				}}>HOME</Link>
				<Link to="/operator/franchise" style={{
					textDecoration: "none",
					color: "#000",
					fontWeight: 600,
					margin: "0 18px",
					fontFamily: "Poppins, sans-serif"
				}}>MY FRANCHISE</Link>
				<div style={{
					marginLeft: "18px",
					background: "#0a3970",
					color: "#fff",
					borderRadius: "18px",
					padding: "6px 18px",
					display: "flex",
					alignItems: "center",
					fontWeight: 600,
					fontFamily: "Poppins, sans-serif"
				}}>
					<span style={{ marginRight: "8px", fontSize: "18px", fontFamily: "Poppins, sans-serif" }}>👤</span>
					USER
				</div>
			</div>
		</nav>
	);
};

export default Sidebar;
