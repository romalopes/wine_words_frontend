import { Navigate, Route, Routes } from "react-router-dom";
import AboutPage from "./about/AboutPage";
import AccountSettings from "./AccountSettings";
import Archive from "./Archive";
import Dashboard from "./Dashboard";
import Home from "./Home";
import Login from "./Login";
import ResetPassword from "./ResetPassword";
import Reviews from "./Reviews";
import ReviewDetail from "./ReviewDetail";
import Articles from "./Articles";
import ArticleDetail from "./ArticleDetail";
import Quiz from "./Quiz";
import WineList from "./WineList";
import WineDetail from "./WineDetail";
import WineForm from "./WineForm";
import WineSearch from "./WineSearch";
import WineProfileList from "./WineProfileList";
import WineProfileDetail from "./WineProfileDetail";
import WineProfileForm from "./WineProfileForm";
import ProducerList from "./ProducerList";
import ProducerDetail from "./ProducerDetail";
import ProducerForm from "./ProducerForm";
import SourceList from "./SourceList";
import SourceDetail from "./SourceDetail";
import ProducerWines from "./ProducerWines";
import UserRoles from "./UserRoles";
import UserDetail from "./UserDetail";
import Categories from "./Categories";
import CategoryDetail from "./CategoryDetail";
import Grapes from "./Grapes";
import GrapeDetail from "./GrapeDetail";
import GrapeWines from "./GrapeWines";
import GrapeProducers from "./GrapeProducers";
import Countries from "./Countries";
import CountryDetail from "./CountryDetail";
import Regions from "./Regions";
import RegionDetail from "./RegionDetail";
import ApiHealth from "./ApiHealth/ApiHealth";
import Subscribe from "./Subscribe";
import TestAccessPage from "./TestAccess";
import SubscriptionAdmin from "./SubscriptionAdmin";
import Logs from "./Logs";
import LogDetail from "./LogDetail";
import Configuration from "./Configuration";
import WinePackages from "./WinePackages";
import WinePackageDetail from "./WinePackageDetail";
import WinePackageForm from "./WinePackageForm";
import Notifications from "./Notifications";
import Following from "./Following";
import VerifyEmail from "./VerifyEmail";
import ArticleProjects from "./ArticleProjects";
import ArticleProjectDetail from "./ArticleProjectDetail";
import ArticleProjectForm from "./ArticleProjectForm";
import AnalyticsDashboard from "./analytics/AnalyticsDashboard";
import ContentAnalyticsDetail from "./analytics/ContentAnalyticsDetail";
import { WineInsights } from "./analytics/WineInsights";
import { ArticlesManagement, ReviewsManagement } from "./ContentManagementList";

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/test-access" element={<TestAccessPage />} />
        <Route element={<AccountSettings />} path="/account" />
        <Route element={<Dashboard />} path="/" />
        <Route element={<Home />} path="/finder" />
        <Route element={<Quiz />} path="quiz" />
        <Route element={<AboutPage />} path="about" />
        <Route element={<Archive />} path="/archive" />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          element={<Navigate replace to="/reviews" />}
          path="/my-reviews"
        />
        <Route element={<Reviews />} path="/reviews" />
        <Route element={<ReviewDetail />} path="/reviews/:slug" />
        <Route element={<ReviewDetail />} path="/reviews/:slug/edit" />
        <Route element={<ReviewsManagement />} path="/settings/reviews" />
        <Route element={<Articles />} path="/articles" />
        <Route element={<ArticleDetail />} path="/articles/:slug" />
        <Route element={<ArticleDetail />} path="/articles/:slug/edit" />
        <Route element={<ArticlesManagement />} path="/settings/articles" />
        <Route element={<WineSearch />} path="/search" />
        <Route element={<WineList />} path="/wines" />
        <Route element={<WineDetail />} path="/wines/:slug" />
        <Route element={<WineForm />} path="/wines/new" />
        <Route element={<WineForm />} path="/wines/:slug/edit" />
        <Route element={<ProducerList />} path="/producers" />
        <Route element={<SourceList />} path="/sources" />
        <Route element={<SourceDetail />} path="/sources/:source" />
        <Route element={<ProducerWines />} path="/producers/:slug/wines" />

        <Route element={<ProducerDetail />} path="/producers/:slug" />
        <Route element={<ProducerForm />} path="/producers/new" />
        <Route element={<ProducerForm />} path="/producers/:slug/edit" />
        <Route element={<UserRoles />} path="/users" />
        <Route element={<UserDetail />} path="/users/:id" />
        <Route element={<Categories />} path="/categories" />
        <Route element={<CategoryDetail />} path="/categories/:slug" />
        <Route element={<Grapes />} path="/grapes" />
        <Route element={<GrapeDetail />} path="/grapes/:slug" />
        <Route element={<GrapeWines />} path="/grapes/:slug/wines" />
        <Route element={<GrapeProducers />} path="/grapes/:slug/producers" />
        <Route element={<Countries />} path="/countries" />
        <Route element={<CountryDetail />} path="/countries/:slug" />
        <Route element={<Regions />} path="/regions" />
        <Route element={<Regions />} path="/regions/:slug/edit" />
        <Route element={<RegionDetail />} path="/regions/:slug" />
        <Route element={<WineProfileList />} path="/wine-profiles" />
        <Route element={<WineProfileForm />} path="/wine-profiles/new" />
        <Route element={<WineProfileDetail />} path="/wine-profiles/:slug" />
        <Route element={<WineProfileForm />} path="/wine-profiles/:slug/edit" />
        <Route element={<ApiHealth />} path="/admin/api-health" />
        <Route element={<Subscribe />} path="/subscribe" />
        <Route element={<SubscriptionAdmin />} path="/subscriptions" />
        <Route element={<Logs />} path="/admin/logs" />
        <Route element={<LogDetail />} path="/admin/logs/:id" />
        <Route element={<Configuration />} path="/admin/configuration" />
        <Route element={<WinePackages />} path="/wine-packages" />
        <Route element={<WinePackageForm />} path="/wine-packages/new" />
        <Route element={<WinePackageDetail />} path="/wine-packages/:id" />
        <Route element={<WinePackageForm />} path="/wine-packages/:id/edit" />
        <Route element={<Notifications />} path="/notifications" />
        <Route element={<Following />} path="/following" />
        <Route element={<ArticleProjects />} path="/article-projects" />
        <Route element={<ArticleProjectForm />} path="/article-projects/new" />
        <Route
          element={<ArticleProjectDetail />}
          path="/article-projects/:id"
        />
        <Route
          element={<ArticleProjectDetail />}
          path="/article-projects/:id/edit"
        />
        <Route element={<AnalyticsDashboard />} path="/analytics" />
        <Route
          element={<ContentAnalyticsDetail />}
          path="/analytics/content/:contentType/:contentId"
        />
        <Route element={<WineInsights />} path="/analytics/wine-insights" />
      </Routes>
    </>
  );
}

export default AppRoutes;
