import React from "react";
import { Link } from "react-router-dom";
import "../../Styles/Operator's CSS/Franchise.css"; 

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
				<Link to="/driver/home" style={{
					textDecoration: "none",
					color: "#000",
					fontWeight: 600,
					margin: "0 18px"
				}}>HOME</Link>
				<Link to="/driver/franchise" style={{
					textDecoration: "none",
					color: "#000",
					fontWeight: 600,
					margin: "0 18px"
				}}>MY FRANCHISE</Link>
				<div style={{
					marginLeft: "18px",
					background: "#0a3970",
					color: "#fff",
					borderRadius: "18px",
					padding: "6px 18px",
					display: "flex",
					alignItems: "center",
					fontWeight: 600
				}}>
					<span style={{ marginRight: "8px", fontSize: "18px" }}>👤</span>
					USER
				</div>
			</div>
		</nav>
	);
};

export default Sidebar;
