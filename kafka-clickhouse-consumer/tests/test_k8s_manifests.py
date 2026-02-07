"""Validate Kubernetes manifests for the sandarb-data platform.

Tests ensure all k8s YAML files are valid, have correct replica counts,
resource limits, and consistent naming for the production-scale deployment.
"""

import os
import yaml
import pytest

K8S_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "k8s")


def _load_all_docs(filename: str) -> list[dict]:
    """Load all YAML documents from a multi-document file."""
    filepath = os.path.join(K8S_DIR, filename)
    with open(filepath, "r") as f:
        return list(yaml.safe_load_all(f))


def _find_by_kind(docs: list[dict], kind: str) -> list[dict]:
    """Filter documents by Kubernetes kind."""
    return [d for d in docs if d and d.get("kind") == kind]


# ── Namespace ─────────────────────────────────────────────────────


class TestNamespaceManifest:
    """Validate k8s/namespace.yaml."""

    def test_namespace_exists(self):
        """namespace.yaml exists and is valid YAML."""
        docs = _load_all_docs("namespace.yaml")
        assert len(docs) >= 1

    def test_namespace_is_sandarb_data(self):
        """Namespace is named sandarb-data."""
        docs = _load_all_docs("namespace.yaml")
        ns = docs[0]
        assert ns["kind"] == "Namespace"
        assert ns["metadata"]["name"] == "sandarb-data"


# ── PostgreSQL (CNPG) ────────────────────────────────────────────


class TestPostgresCNPG:
    """Validate k8s/postgres-cnpg.yaml for CNPG HA cluster."""

    @pytest.fixture(autouse=True)
    def _load(self):
        self.docs = _load_all_docs("postgres-cnpg.yaml")
        self.clusters = _find_by_kind(self.docs, "Cluster")
        self.secrets = _find_by_kind(self.docs, "Secret")
        self.services = _find_by_kind(self.docs, "Service")

    def test_cluster_exists(self):
        """CNPG Cluster CRD exists."""
        assert len(self.clusters) == 1

    def test_cluster_name(self):
        """Cluster is named sandarb-postgres."""
        assert self.clusters[0]["metadata"]["name"] == "sandarb-postgres"

    def test_cluster_namespace(self):
        """Cluster is in sandarb-data namespace."""
        assert self.clusters[0]["metadata"]["namespace"] == "sandarb-data"

    def test_three_instances(self):
        """Cluster has 3 instances (1 primary + 2 standbys)."""
        assert self.clusters[0]["spec"]["instances"] == 3

    def test_bootstrap_database(self):
        """Bootstrap creates the sandarb database."""
        bootstrap = self.clusters[0]["spec"]["bootstrap"]["initdb"]
        assert bootstrap["database"] == "sandarb"

    def test_superset_database_created(self):
        """Bootstrap SQL creates the superset database."""
        post_init = self.clusters[0]["spec"]["bootstrap"]["initdb"]["postInitApplicationSQL"]
        superset_found = any("superset" in sql.lower() for sql in post_init)
        assert superset_found, "superset database not created in postInitApplicationSQL"

    def test_storage_class(self):
        """Storage uses premium-rwo for GKE SSD."""
        storage = self.clusters[0]["spec"]["storage"]
        assert storage["storageClass"] == "premium-rwo"

    def test_storage_size(self):
        """Each instance gets 20Gi storage."""
        storage = self.clusters[0]["spec"]["storage"]
        assert storage["size"] == "20Gi"

    def test_resource_requests(self):
        """Cluster requests at least 1 CPU and 2Gi memory."""
        resources = self.clusters[0]["spec"]["resources"]
        assert resources["requests"]["cpu"] == "1"
        assert resources["requests"]["memory"] == "2Gi"

    def test_sync_replication(self):
        """Synchronous replication configured for durability."""
        spec = self.clusters[0]["spec"]
        assert spec["minSyncReplicas"] >= 1
        assert spec["maxSyncReplicas"] >= 1

    def test_monitoring_enabled(self):
        """Prometheus monitoring is enabled."""
        monitoring = self.clusters[0]["spec"]["monitoring"]
        assert monitoring["enablePodMonitor"] is True

    def test_affinity_configured(self):
        """Pod anti-affinity spreads instances across nodes."""
        affinity = self.clusters[0]["spec"]["affinity"]
        assert affinity["topologyKey"] == "kubernetes.io/hostname"

    def test_credentials_secret_exists(self):
        """Credentials Secret exists."""
        cred_secrets = [s for s in self.secrets if s["metadata"]["name"] == "sandarb-postgres-credentials"]
        assert len(cred_secrets) == 1

    def test_credentials_secret_type(self):
        """Credentials Secret is kubernetes.io/basic-auth type."""
        cred_secret = [s for s in self.secrets if s["metadata"]["name"] == "sandarb-postgres-credentials"][0]
        assert cred_secret["type"] == "kubernetes.io/basic-auth"

    def test_rw_service_exists(self):
        """Read-write Service routes to primary."""
        rw_services = [s for s in self.services if s["metadata"]["name"] == "sandarb-postgres-rw"]
        assert len(rw_services) == 1
        assert rw_services[0]["spec"]["selector"]["role"] == "primary"

    def test_ro_service_exists(self):
        """Read-only Service routes to replicas."""
        ro_services = [s for s in self.services if s["metadata"]["name"] == "sandarb-postgres-ro"]
        assert len(ro_services) == 1
        assert ro_services[0]["spec"]["selector"]["role"] == "replica"

    def test_services_on_port_5432(self):
        """Both services expose port 5432."""
        for svc in self.services:
            ports = svc["spec"]["ports"]
            assert any(p["port"] == 5432 for p in ports)

    def test_all_in_sandarb_data_namespace(self):
        """All resources are in the sandarb-data namespace."""
        for doc in self.docs:
            if doc:
                assert doc["metadata"]["namespace"] == "sandarb-data"

    def test_postgresql_parameters(self):
        """PostgreSQL has tuned parameters."""
        params = self.clusters[0]["spec"]["postgresql"]["parameters"]
        assert int(params["max_connections"]) >= 200
        assert "shared_buffers" in params


# ── Kafka StatefulSet ─────────────────────────────────────────────


class TestKafkaManifest:
    """Validate k8s/kafka-statefulset.yaml for 5-broker production cluster."""

    @pytest.fixture(autouse=True)
    def _load(self):
        self.docs = _load_all_docs("kafka-statefulset.yaml")
        self.services = _find_by_kind(self.docs, "Service")
        self.statefulsets = _find_by_kind(self.docs, "StatefulSet")

    def test_has_headless_service(self):
        """Headless service exists for broker discovery."""
        headless = [s for s in self.services if s["spec"].get("clusterIP") == "None"]
        assert len(headless) == 1
        assert headless[0]["metadata"]["name"] == "kafka-brokers"

    def test_statefulset_replicas(self):
        """StatefulSet has 5 replicas (3 controller+broker, 2 broker-only)."""
        assert len(self.statefulsets) == 1
        ss = self.statefulsets[0]
        assert ss["spec"]["replicas"] == 5

    def test_namespace(self):
        """All resources are in the sandarb-data namespace."""
        for doc in self.docs:
            if doc:
                assert doc["metadata"]["namespace"] == "sandarb-data"

    def test_uses_latest_image(self):
        """Kafka uses the latest image tag."""
        ss = self.statefulsets[0]
        image = ss["spec"]["template"]["spec"]["containers"][0]["image"]
        assert image == "apache/kafka:latest"

    def test_has_volume_claim_template(self):
        """StatefulSet has persistent volume claims for data."""
        ss = self.statefulsets[0]
        vcts = ss["spec"].get("volumeClaimTemplates", [])
        assert len(vcts) >= 1
        assert vcts[0]["metadata"]["name"] == "data"

    def test_storage_size(self):
        """Each broker gets 50Gi storage."""
        ss = self.statefulsets[0]
        storage = ss["spec"]["volumeClaimTemplates"][0]["spec"]["resources"]["requests"]["storage"]
        assert storage == "50Gi"

    def test_resource_requests(self):
        """Brokers request at least 2 CPU and 4Gi memory."""
        ss = self.statefulsets[0]
        resources = ss["spec"]["template"]["spec"]["containers"][0]["resources"]
        assert resources["requests"]["cpu"] == "2"
        assert resources["requests"]["memory"] == "4Gi"

    def test_readiness_probe(self):
        """Brokers have a readiness probe on port 9092."""
        ss = self.statefulsets[0]
        probe = ss["spec"]["template"]["spec"]["containers"][0]["readinessProbe"]
        assert probe["tcpSocket"]["port"] == 9092

    def test_quorum_voters_has_three(self):
        """KAFKA_CONTROLLER_QUORUM_VOTERS references 3 controller nodes."""
        ss = self.statefulsets[0]
        env_vars = {e["name"]: e["value"] for e in ss["spec"]["template"]["spec"]["containers"][0]["env"]}
        voters = env_vars.get("KAFKA_CONTROLLER_QUORUM_VOTERS", "")
        assert voters.count("@") == 3  # 3 voters

    def test_default_partitions(self):
        """Default partition count is 12 for high throughput."""
        ss = self.statefulsets[0]
        env_vars = {e["name"]: e["value"] for e in ss["spec"]["template"]["spec"]["containers"][0]["env"]}
        assert env_vars.get("KAFKA_NUM_PARTITIONS") == "12"

    def test_replication_factor(self):
        """Default replication factor is 3."""
        ss = self.statefulsets[0]
        env_vars = {e["name"]: e["value"] for e in ss["spec"]["template"]["spec"]["containers"][0]["env"]}
        assert env_vars.get("KAFKA_DEFAULT_REPLICATION_FACTOR") == "3"

    def test_min_insync_replicas(self):
        """Min insync replicas is 2."""
        ss = self.statefulsets[0]
        env_vars = {e["name"]: e["value"] for e in ss["spec"]["template"]["spec"]["containers"][0]["env"]}
        assert env_vars.get("KAFKA_MIN_INSYNC_REPLICAS") == "2"


# ── ClickHouse ConfigMap ──────────────────────────────────────────


class TestClickHouseConfigMap:
    """Validate k8s/clickhouse-configmap.yaml for 5-node cluster."""

    @pytest.fixture(autouse=True)
    def _load(self):
        self.docs = _load_all_docs("clickhouse-configmap.yaml")
        self.configmaps = _find_by_kind(self.docs, "ConfigMap")

    def test_configmap_exists(self):
        """ConfigMap exists."""
        assert len(self.configmaps) == 1

    def test_has_cluster_config(self):
        """ConfigMap contains cluster_config.xml."""
        cm = self.configmaps[0]
        assert "cluster_config.xml" in cm["data"]

    def test_has_five_macros_files(self):
        """ConfigMap has macros for all 5 nodes."""
        cm = self.configmaps[0]
        for i in range(5):
            key = f"macros_node{i}.xml"
            assert key in cm["data"], f"Missing {key}"

    def test_two_shards_in_cluster_config(self):
        """Cluster config defines 2 shards."""
        cm = self.configmaps[0]
        config = cm["data"]["cluster_config.xml"]
        assert config.count("<shard>") == 2

    def test_five_replicas_total(self):
        """Cluster config defines 5 replicas total across all shards."""
        cm = self.configmaps[0]
        config = cm["data"]["cluster_config.xml"]
        assert config.count("<replica>") == 5

    def test_three_keepers(self):
        """Cluster config references 3 Keeper nodes."""
        cm = self.configmaps[0]
        config = cm["data"]["cluster_config.xml"]
        assert config.count("clickhouse-keeper-") == 3

    def test_shard_assignment(self):
        """Nodes 0-2 are shard 01, nodes 3-4 are shard 02."""
        cm = self.configmaps[0]
        # Shard 01: nodes 0, 1, 2
        for i in range(3):
            macros = cm["data"][f"macros_node{i}.xml"]
            assert "<shard>01</shard>" in macros
        # Shard 02: nodes 3, 4
        for i in range(3, 5):
            macros = cm["data"][f"macros_node{i}.xml"]
            assert "<shard>02</shard>" in macros


# ── ClickHouse StatefulSet ────────────────────────────────────────


class TestClickHouseStatefulSet:
    """Validate k8s/clickhouse-statefulset.yaml for 5 nodes + 3 Keepers."""

    @pytest.fixture(autouse=True)
    def _load(self):
        self.docs = _load_all_docs("clickhouse-statefulset.yaml")
        self.services = _find_by_kind(self.docs, "Service")
        self.statefulsets = _find_by_kind(self.docs, "StatefulSet")

    def test_two_statefulsets(self):
        """Two StatefulSets: one for Keeper, one for ClickHouse nodes."""
        assert len(self.statefulsets) == 2
        names = sorted([ss["metadata"]["name"] for ss in self.statefulsets])
        assert names == ["clickhouse", "clickhouse-keeper"]

    def test_keeper_replicas(self):
        """Keeper StatefulSet has 3 replicas for HA."""
        keeper = [ss for ss in self.statefulsets if ss["metadata"]["name"] == "clickhouse-keeper"][0]
        assert keeper["spec"]["replicas"] == 3

    def test_clickhouse_replicas(self):
        """ClickHouse StatefulSet has 5 replicas."""
        ch = [ss for ss in self.statefulsets if ss["metadata"]["name"] == "clickhouse"][0]
        assert ch["spec"]["replicas"] == 5

    def test_clickhouse_uses_latest_image(self):
        """ClickHouse uses the latest image tag."""
        ch = [ss for ss in self.statefulsets if ss["metadata"]["name"] == "clickhouse"][0]
        image = ch["spec"]["template"]["spec"]["containers"][0]["image"]
        assert image == "clickhouse/clickhouse-server:latest"

    def test_keeper_uses_latest_image(self):
        """Keeper uses the latest image tag."""
        keeper = [ss for ss in self.statefulsets if ss["metadata"]["name"] == "clickhouse-keeper"][0]
        image = keeper["spec"]["template"]["spec"]["containers"][0]["image"]
        assert image == "clickhouse/clickhouse-keeper:latest"

    def test_clickhouse_storage_100gi(self):
        """Each ClickHouse node gets 100Gi storage."""
        ch = [ss for ss in self.statefulsets if ss["metadata"]["name"] == "clickhouse"][0]
        storage = ch["spec"]["volumeClaimTemplates"][0]["spec"]["resources"]["requests"]["storage"]
        assert storage == "100Gi"

    def test_keeper_has_persistent_storage(self):
        """Keeper has persistent storage for coordination data."""
        keeper = [ss for ss in self.statefulsets if ss["metadata"]["name"] == "clickhouse-keeper"][0]
        vcts = keeper["spec"].get("volumeClaimTemplates", [])
        assert len(vcts) >= 1

    def test_headless_service(self):
        """Headless service exists for inter-node discovery."""
        headless = [s for s in self.services if s["spec"].get("clusterIP") == "None"]
        assert len(headless) >= 1

    def test_client_service(self):
        """Client-facing service exists (non-headless)."""
        client_svc = [s for s in self.services if s["spec"].get("clusterIP") is None and s["metadata"]["name"] == "clickhouse"]
        assert len(client_svc) == 1

    def test_clickhouse_resource_requests(self):
        """ClickHouse nodes request at least 2 CPU and 4Gi memory."""
        ch = [ss for ss in self.statefulsets if ss["metadata"]["name"] == "clickhouse"][0]
        resources = ch["spec"]["template"]["spec"]["containers"][0]["resources"]
        assert resources["requests"]["cpu"] == "2"
        assert resources["requests"]["memory"] == "4Gi"

    def test_clickhouse_readiness_probe(self):
        """ClickHouse has HTTP readiness probe on /ping."""
        ch = [ss for ss in self.statefulsets if ss["metadata"]["name"] == "clickhouse"][0]
        probe = ch["spec"]["template"]["spec"]["containers"][0]["readinessProbe"]
        assert probe["httpGet"]["path"] == "/ping"
        assert probe["httpGet"]["port"] == 8123

    def test_password_from_secret(self):
        """ClickHouse password comes from a Kubernetes Secret."""
        ch = [ss for ss in self.statefulsets if ss["metadata"]["name"] == "clickhouse"][0]
        env_vars = ch["spec"]["template"]["spec"]["containers"][0]["env"]
        password_env = [e for e in env_vars if e["name"] == "CLICKHOUSE_PASSWORD"]
        assert len(password_env) == 1
        assert "secretKeyRef" in password_env[0]["valueFrom"]

    def test_all_in_sandarb_data_namespace(self):
        """All resources are in the sandarb-data namespace."""
        for doc in self.docs:
            if doc:
                assert doc["metadata"]["namespace"] == "sandarb-data"


# ── Consumer Deployment ───────────────────────────────────────────


class TestConsumerDeployment:
    """Validate k8s/consumer-deployment.yaml for scaled consumption."""

    @pytest.fixture(autouse=True)
    def _load(self):
        self.docs = _load_all_docs("consumer-deployment.yaml")
        self.deployments = _find_by_kind(self.docs, "Deployment")
        self.services = _find_by_kind(self.docs, "Service")

    def test_deployment_exists(self):
        """Consumer Deployment exists."""
        assert len(self.deployments) == 1

    def test_three_replicas(self):
        """Consumer has 3 replicas for horizontal scaling."""
        dep = self.deployments[0]
        assert dep["spec"]["replicas"] == 3

    def test_bootstrap_servers_has_five_brokers(self):
        """Bootstrap servers lists all 5 Kafka brokers."""
        dep = self.deployments[0]
        env_vars = {e["name"]: e.get("value", "") for e in dep["spec"]["template"]["spec"]["containers"][0]["env"]}
        servers = env_vars.get("KAFKA_BOOTSTRAP_SERVERS", "")
        broker_list = [s.strip() for s in servers.split(",")]
        assert len(broker_list) == 5

    def test_batch_size_scaled(self):
        """Batch size is increased for high throughput."""
        dep = self.deployments[0]
        env_vars = {e["name"]: e.get("value", "") for e in dep["spec"]["template"]["spec"]["containers"][0]["env"]}
        batch_size = int(env_vars.get("BATCH_SIZE", "0"))
        assert batch_size >= 5000

    def test_health_probe(self):
        """Consumer has readiness and liveness probes on /health."""
        dep = self.deployments[0]
        container = dep["spec"]["template"]["spec"]["containers"][0]
        assert container["readinessProbe"]["httpGet"]["path"] == "/health"
        assert container["livenessProbe"]["httpGet"]["path"] == "/health"

    def test_service_exists(self):
        """Consumer Service exists."""
        assert len(self.services) == 1
        assert self.services[0]["metadata"]["name"] == "sandarb-consumer"

    def test_clickhouse_password_from_secret(self):
        """ClickHouse password comes from a Kubernetes Secret."""
        dep = self.deployments[0]
        env_vars = dep["spec"]["template"]["spec"]["containers"][0]["env"]
        password_env = [e for e in env_vars if e["name"] == "CLICKHOUSE_PASSWORD"]
        assert len(password_env) == 1
        assert "secretKeyRef" in password_env[0]["valueFrom"]

    def test_consumer_group_id(self):
        """Consumer group ID is set for coordinated consumption."""
        dep = self.deployments[0]
        env_vars = {e["name"]: e.get("value", "") for e in dep["spec"]["template"]["spec"]["containers"][0]["env"]}
        assert env_vars.get("KAFKA_GROUP_ID") == "sandarb-clickhouse-consumer"

    def test_resource_requests(self):
        """Consumer requests at least 1 CPU and 2Gi memory."""
        dep = self.deployments[0]
        resources = dep["spec"]["template"]["spec"]["containers"][0]["resources"]
        assert resources["requests"]["cpu"] == "1"
        assert resources["requests"]["memory"] == "2Gi"


# ── Superset Deployment ───────────────────────────────────────────


class TestSupersetDeployment:
    """Validate k8s/superset-deployment.yaml for HA (2 replicas, CNPG PostgreSQL)."""

    @pytest.fixture(autouse=True)
    def _load(self):
        self.docs = _load_all_docs("superset-deployment.yaml")
        self.deployments = _find_by_kind(self.docs, "Deployment")
        self.services = _find_by_kind(self.docs, "Service")

    def test_deployment_exists(self):
        """Superset Deployment exists."""
        assert len(self.deployments) == 1

    def test_two_replicas(self):
        """Superset has 2 replicas for HA."""
        dep = self.deployments[0]
        assert dep["spec"]["replicas"] == 2

    def test_has_init_container(self):
        """Deployment has an init container for DB migrations."""
        dep = self.deployments[0]
        init_containers = dep["spec"]["template"]["spec"].get("initContainers", [])
        assert len(init_containers) >= 1

    def test_service_on_port_8088(self):
        """Superset Service exposes port 8088."""
        assert len(self.services) == 1
        ports = self.services[0]["spec"]["ports"]
        assert any(p["port"] == 8088 for p in ports)

    def test_health_probe(self):
        """Superset has health probes on /health."""
        dep = self.deployments[0]
        container = dep["spec"]["template"]["spec"]["containers"][0]
        assert container["readinessProbe"]["httpGet"]["path"] == "/health"

    def test_secret_key_from_secret(self):
        """Superset secret key comes from a Kubernetes Secret."""
        dep = self.deployments[0]
        env_vars = dep["spec"]["template"]["spec"]["containers"][0]["env"]
        secret_env = [e for e in env_vars if e["name"] == "SUPERSET_SECRET_KEY"]
        assert len(secret_env) == 1
        assert "secretKeyRef" in secret_env[0]["valueFrom"]

    def test_postgres_password_from_cnpg_secret(self):
        """PostgreSQL password comes from CNPG credentials secret."""
        dep = self.deployments[0]
        env_vars = dep["spec"]["template"]["spec"]["containers"][0]["env"]
        pg_env = [e for e in env_vars if e["name"] == "POSTGRES_PASSWORD"]
        assert len(pg_env) == 1
        assert pg_env[0]["valueFrom"]["secretKeyRef"]["name"] == "sandarb-postgres-credentials"

    def test_database_uri_uses_cnpg_rw_service(self):
        """Database URI connects to CNPG read-write service."""
        dep = self.deployments[0]
        env_vars = dep["spec"]["template"]["spec"]["containers"][0]["env"]
        db_uri = [e for e in env_vars if e["name"] == "SQLALCHEMY_DATABASE_URI"]
        assert len(db_uri) == 1
        assert "sandarb-postgres-rw" in db_uri[0]["value"]
        assert "superset" in db_uri[0]["value"]

    def test_all_in_sandarb_data_namespace(self):
        """All resources are in the sandarb-data namespace."""
        for doc in self.docs:
            if doc:
                assert doc["metadata"]["namespace"] == "sandarb-data"
