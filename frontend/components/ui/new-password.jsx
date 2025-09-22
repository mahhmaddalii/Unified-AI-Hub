              "use client";

          import { useState, useEffect } from "react";

          export default function ConfirmPassword({ onSubmit, isLoading = false }) {
            const [password, setPassword] = useState("");
            const [confirmPassword, setConfirmPassword] = useState("");
            const [message, setMessage] = useState("");
            const [error, setError] = useState("");
            const [passwordStrength, setPasswordStrength] = useState(0);
            const [showPassword, setShowPassword] = useState(false);
            const [showConfirmPassword, setShowConfirmPassword] = useState(false);
            const [isFormLoading, setIsFormLoading] = useState(false);
            const [isMounted, setIsMounted] = useState(false);

            useEffect(() => {
              setIsMounted(true);
              return () => setIsMounted(false);
            }, []);

            // Check password strength
            useEffect(() => {
              let strength = 0;
              if (password.length >= 8) strength += 1;
              if (/[A-Z]/.test(password)) strength += 1;
              if (/[0-9]/.test(password)) strength += 1;
              if (/[^A-Za-z0-9]/.test(password)) strength += 1;
              setPasswordStrength(strength);
            }, [password]);

            const handleSubmit = async (e) => {
              e.preventDefault();
              setMessage("");
              setError("");
              
              // Validate passwords match
              if (password !== confirmPassword) {
                setError("Passwords do not match");
                return;
              }

              // Validate password strength
              if (passwordStrength < 3) {
                setError("Please choose a stronger password");
                return;
              }

              setIsFormLoading(true);
              
              try {
                // Call the onSubmit prop if provided
                if (onSubmit) {
                  await onSubmit(password);
                } else {
                  // Default behavior if no onSubmit prop
                  setMessage("Password has been reset successfully!");
                  setPassword("");
                  setConfirmPassword("");
                }
              } catch (err) {
                setError(err.message || "An error occurred. Please try again.");
              } finally {
                setIsFormLoading(false);
              }
            };

            const getPasswordStrengthColor = () => {
              if (passwordStrength === 0) return "bg-gray-200";
              if (passwordStrength === 1) return "bg-red-500";
              if (passwordStrength === 2) return "bg-yellow-500";
              if (passwordStrength === 3) return "bg-blue-500";
              return "bg-green-500";
            };

            const getPasswordStrengthText = () => {
              if (passwordStrength === 0) return "";
              if (passwordStrength === 1) return "Weak";
              if (passwordStrength === 2) return "Fair";
              if (passwordStrength === 3) return "Good";
              return "Strong";
            };

            // Skeleton loading state
            if (isLoading) {
              return (
                <div className="flex flex-col text-center w-full animate-pulse">
                  <div className="h-10 bg-gray-200 rounded-xl mb-4 mx-auto w-3/4"></div>
                  <div className="h-6 bg-gray-200 rounded-xl mb-8 mx-auto w-2/3"></div>
                  
                  <div className="text-left mb-4">
                    <div className="h-5 bg-gray-200 rounded mb-2 w-1/3"></div>
                    <div className="h-12 bg-gray-200 rounded-2xl mb-2"></div>
                    <div className="h-2 bg-gray-200 rounded-full w-full"></div>
                  </div>
                  
                  <div className="text-left mb-6">
                    <div className="h-5 bg-gray-200 rounded mb-2 w-2/5"></div>
                    <div className="h-12 bg-gray-200 rounded-2xl"></div>
                  </div>
                  
                  <div className="text-left mb-4 bg-gray-100 p-4 rounded-2xl">
                    <div className="h-5 bg-gray-200 rounded mb-3 w-2/5"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </div>
                  
                  <div className="h-12 bg-gray-200 rounded-2xl mx-auto w-40"></div>
                </div>
              );
            }

            return (
              <form onSubmit={handleSubmit} className="flex flex-col text-center w-full">
                <h3 className="text-4xl font-extrabold text-gray-900 mb-3 ">Set New Password</h3>
                <p className="text-gray-700 mb-6 ">Please enter your new password below</p>

                <div className="text-left mb-4 animate-fade-in delay-200">
                  <label htmlFor="password" className="block text-sm text-gray-900 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isFormLoading}
                      className="w-full px-5 py-3 text-sm text-gray-900 bg-gray-100 rounded-2xl outline-none focus:bg-gray-200 pr-12 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={isFormLoading}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-purple-600 transition-colors duration-300 disabled:opacity-50"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  {/* Password strength indicator */}
                  {password && (
                    <div className="mt-2 animate-fade-in">
                      <div className="flex items-center justify-between mb-1">
                        <div className="h-2 w-full bg-gray-200 rounded-full mr-2 transition-all duration-300">
                          <div
                            className={`h-full rounded-full ${getPasswordStrengthColor()} transition-all duration-300`}
                            style={{ width: `${(passwordStrength / 4) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600 transition-colors duration-300">{getPasswordStrengthText()}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-left mb-6 animate-fade-in delay-300">
                  <label htmlFor="confirmPassword" className="block text-sm text-gray-900 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isFormLoading}
                      className="w-full px-5 py-3 text-sm text-gray-900 bg-gray-100 rounded-2xl outline-none focus:bg-gray-200 pr-12 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={isFormLoading}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-purple-600 transition-colors duration-300 disabled:opacity-50"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Password requirements */}
                <div className="text-left mb-4 bg-purple-50 p-4 rounded-2xl animate-fade-in delay-400">
                  <p className="text-sm font-semibold text-purple-800 mb-2">Password requirements:</p>
                  <ul className="text-xs text-purple-600 space-y-1">
                    <li className={`flex items-center transition-colors duration-300 ${password.length >= 8 ? 'text-green-500' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-colors duration-300 ${password.length >= 8 ? 'text-green-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                        {password.length >= 8 ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                        )}
                      </svg>
                      At least 8 characters long
                    </li>
                    <li className={`flex items-center transition-colors duration-300 ${/[A-Z]/.test(password) ? 'text-green-500' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-colors duration-300 ${/[A-Z]/.test(password) ? 'text-green-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                        {/[A-Z]/.test(password) ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                        )}
                      </svg>
                      One uppercase letter
                    </li>
                    <li className={`flex items-center transition-colors duration-300 ${/[0-9]/.test(password) ? 'text-green-500' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-colors duration-300 ${/[0-9]/.test(password) ? 'text-green-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                        {/[0-9]/.test(password) ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                        )}
                      </svg>
                      One number
                      </li>
                    <li className={`flex items-center transition-colors duration-300 ${/[^A-Za-z0-9]/.test(password) ? 'text-green-500' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-colors duration-300 ${/[^A-Za-z0-9]/.test(password) ? 'text-green-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                        {/[^A-Za-z0-9]/.test(password) ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                        )}
                      </svg>
                      One special character
                    </li>
                  </ul>
                </div>

                {/* Success or Error Messages */}
                {message && (
                  <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-xl flex items-center animate-fade-in">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {message}
                  </div>
                )}
                {error && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl flex items-center animate-fade-in">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                <div className="flex justify-center animate-fade-in delay-500">
                  <button
                    type="submit"
                    disabled={isFormLoading}
                    className="w-50 py-3 px-8 text-white bg-purple-600 hover:bg-purple-700 rounded-2xl font-bold transition-all duration-300 disabled:opacity-70 flex items-center justify-center transform hover:scale-105 disabled:hover:scale-100"
                  >
                    {isFormLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Resetting...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </button>
                </div>
              </form>
            );
          }