import React from 'react';

const Badge = ({ className, variant, children }) => {
  const baseStyles = "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full";
  const variantStyles = variant === "beta" ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-800";

  return (
    <span className={`${baseStyles} ${variantStyles} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
