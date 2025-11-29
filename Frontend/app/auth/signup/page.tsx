// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';
// import { Eye, EyeOff, Mail, Lock, User, Chrome } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Checkbox } from '@/components/ui/checkbox';
// import apiClient from '@/lib/apiClient';

// export default function SignupPage() {
//   const [formData, setFormData] = useState({
//     fullName: '',
//     email: '',
//     password: '',
//     confirmPassword: '',
//     agreeToTerms: false,
//   });
//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);

//   const handleInputChange = (field: string, value: string | boolean) => {
//     setFormData(prev => ({ ...prev, [field]: value }));
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setIsLoading(true);

//     try {
//       const data = await apiClient.signup({
//         fullName: formData.fullName,
//         email: formData.email,
//         password: formData.password,
//       });

//       // Store token in localStorage
//       localStorage.setItem('token', data.token);
//       localStorage.setItem('user', JSON.stringify(data.user));

//       // Redirect to dashboard
//       window.location.href = '/dashboard';
//     } catch (error: any) {
//       console.error('Signup error:', error);
//       alert(error.message || 'Signup failed');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleGoogleSignIn = () => {
//     // Google sign-in placeholder
//     console.log('Google sign-in');
//   };

//   const isFormValid = formData.fullName && formData.email && formData.password &&
//                      formData.confirmPassword && formData.password === formData.confirmPassword && formData.agreeToTerms;

//   return (
// <div className="min-h-screen bg-gradient-to-br from-[#E0EAFC] via-[#E8ECFF] to-[#F3E8FF] flex items-center justify-center p-4 relative overflow-hidden">

//       {/* Professional background elements */}
//       <div className="absolute inset-0 overflow-hidden">
//         <div className="absolute top-20 left-20 w-32 h-32 bg-green-100 rounded-full opacity-30 blur-2xl"></div>
//         <div className="absolute bottom-20 right-20 w-40 h-40 bg-blue-100 rounded-full opacity-20 blur-2xl"></div>
//         <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-green-50 to-blue-50 rounded-full opacity-40 blur-3xl"></div>
//       </div>

//       <div className="w-full max-w-lg animate-in fade-in-0 slide-in-from-bottom-4 duration-700 relative z-10">
//         <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 relative">
//           {/* Card header */}
//           <div className="text-center mb-6">
//             <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mx-auto mb-3 flex items-center justify-center shadow-md">
//               <User className="w-6 h-6 text-white" />
//             </div>
//             <h1 className="text-xl font-bold text-gray-900 mb-1">Create Your Account</h1>
//             <p className="text-sm text-gray-600">Join us to manage your warehouse efficiently</p>
//           </div>

//           <form onSubmit={handleSubmit} className="space-y-4">
//             {/* Full Name */}
//             <div className="space-y-2">
//               <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">Full Name</Label>
//               <div className="relative">
//                 <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
//                 <Input
//                   id="fullName"
//                   type="text"
//                   placeholder="Enter your full name"
//                   value={formData.fullName}
//                   onChange={(e) => handleInputChange('fullName', e.target.value)}
//                   className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
//                   autoComplete="name"
//                   required
//                 />
//               </div>
//             </div>

//             {/* Email */}
//             <div className="space-y-2">
//               <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
//               <div className="relative">
//                 <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
//                 <Input
//                   id="email"
//                   type="email"
//                   placeholder="Enter your email address"
//                   value={formData.email}
//                   onChange={(e) => handleInputChange('email', e.target.value)}
//                   className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
//                   autoComplete="email"
//                   required
//                 />
//               </div>
//             </div>

//             {/* Password */}
//             <div className="space-y-2">
//               <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
//               <div className="relative">
//                 <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
//                 <Input
//                   id="password"
//                   type={showPassword ? 'text' : 'password'}
//                   placeholder="Create a strong password"
//                   value={formData.password}
//                   onChange={(e) => handleInputChange('password', e.target.value)}
//                   className="pl-10 pr-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
//                   autoComplete="new-password"
//                   required
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword(!showPassword)}
//                   className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
//                 >
//                   {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
//                 </button>
//               </div>
//             </div>

//             {/* Confirm Password */}
//             <div className="space-y-2">
//               <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm Password</Label>
//               <div className="relative">
//                 <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
//                 <Input
//                   id="confirmPassword"
//                   type={showConfirmPassword ? 'text' : 'password'}
//                   placeholder="Confirm your password"
//                   value={formData.confirmPassword}
//                   onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
//                   className="pl-10 pr-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
//                   autoComplete="new-password"
//                   required
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowConfirmPassword(!showConfirmPassword)}
//                   className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
//                 >
//                   {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
//                 </button>
//               </div>
//             </div>

//             {/* Terms Checkbox */}
//             <div className="flex items-start space-x-3">
//               <Checkbox
//                 id="terms"
//                 checked={formData.agreeToTerms}
//                 onCheckedChange={(checked) => handleInputChange('agreeToTerms', !!checked)}
//                 className="mt-1"
//               />
//               <Label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed">
//                 I agree to the{' '}
//                 <Link href="/terms" className="text-blue-600 hover:text-blue-500 underline">
//                   Terms & Conditions
//                 </Link>{' '}
//                 and{' '}
//                 <Link href="/privacy" className="text-blue-600 hover:text-blue-500 underline">
//                   Privacy Policy
//                 </Link>
//               </Label>
//             </div>

//             {/* Sign Up Button */}
//             <Button
//               type="submit"
//               disabled={isLoading || !isFormValid}
//               className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
//             >
//               {isLoading ? 'Creating Account...' : 'Sign Up'}
//             </Button>
//           </form>

//           {/* Divider */}
//           <div className="flex items-center my-4">
//             <div className="flex-1 border-t border-gray-200"></div>
//             <span className="px-3 text-sm text-gray-500 bg-white">Or continue with</span>
//             <div className="flex-1 border-t border-gray-200"></div>
//           </div>

//           {/* Google Sign In */}
//           <Button
//             onClick={handleGoogleSignIn}
//             variant="outline"
//             className="w-full h-10 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg transition-all duration-200"
//           >
//             <Chrome className="h-4 w-4 mr-2 text-red-500" />
//             Continue with Google
//           </Button>

//           {/* Footer */}
//           <div className="text-center mt-6">
//             <p className="text-gray-600">
//               Already have an account?{' '}
//               <Link href="/auth/login" className="text-blue-600 hover:text-blue-500 font-semibold transition-colors">
//                 Sign in
//               </Link>
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, User, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import apiClient from '@/lib/apiClient';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = await apiClient.signup({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('Signup error:', error);
      alert(error.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    console.log('Google sign-in');
  };

  const isFormValid =
    formData.fullName &&
    formData.email &&
    formData.password &&
    formData.confirmPassword &&
    formData.password === formData.confirmPassword &&
    formData.agreeToTerms;

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-gradient-to-br from-white/10 via-[#F8FAFF]/20 to-blue-50/30 backdrop-blur-xl">

      {/* Soft Floating Blobs */}
      <div className="absolute -top-24 -left-20 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-purple-300/20 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-green-200/25 rounded-full blur-[80px]"></div>

      {/* Signup Card */}
      <div className="w-full max-w-lg animate-in fade-in-0 slide-in-from-bottom-4 duration-700 relative z-10">
        <div className="bg-white/20 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/30 p-8 transition-all">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <User className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Create Your Account</h1>
            <p className="text-sm text-gray-600 mt-1">Start managing your warehouse efficiently</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="pl-11 h-12 bg-white/40 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-11 h-12 bg-white/40 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="pl-11 pr-11 h-12 bg-white/40 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="pl-11 pr-11 h-12 bg-white/40 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start space-x-3 mt-2">
              <Checkbox
                id="terms"
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) => handleInputChange('agreeToTerms', !!checked)}
              />
              <Label htmlFor="terms" className="text-sm text-gray-700">
                I agree to the{' '}
                <Link href="/terms" className="text-blue-600 underline">Terms</Link>
                {' & '}
                <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>
              </Label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!isFormValid || isLoading}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-xl text-white font-semibold rounded-xl shadow-md transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50"
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-gray-300/40"></div>
            <span className="px-3 text-sm text-gray-600 bg-white/30 backdrop-blur-sm rounded-lg">
              Or continue with
            </span>
            <div className="flex-1 border-t border-gray-300/40"></div>
          </div>

          {/* Google */}
          <Button
            onClick={handleGoogleSignIn}
            variant="outline"
            className="w-full h-11 border-gray-300/50 hover:bg-white/40 rounded-xl backdrop-blur-md transition-all"
          >
            <Chrome className="h-5 w-5 mr-2 text-red-500" />
            Continue with Google
          </Button>

          {/* Footer */}
          <p className="text-center mt-6 text-gray-700">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-600 font-semibold hover:text-blue-700">
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

