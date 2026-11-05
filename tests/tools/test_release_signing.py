import base64
import contextlib
import hashlib
import importlib.util
import io
import os
import pathlib
import stat
import tempfile
import unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[2]
def load(name):
    s=importlib.util.spec_from_file_location(name,ROOT/'tools'/f'{name}.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
material=load('signing-material');stage=load('stage-apk-release')
enrollment=load('enroll-signing-key')
A='a'*64;B='b'*64

class ReleaseSafety(unittest.TestCase):
    def info(self,**over):
        return dict(verified=True,debuggable=False,signerCount=1,signers=[{'sha256':A,'debug':False}],package='com.bleled.com',versionCode=10201,minSdk=24,**over)
    def test_same_key_report_is_explicitly_compatible(self):
        self.assertTrue(stage.assess(self.info(),A,A,10200)['compatibleInPlace'])
    def test_new_key_reports_migration_instead_of_in_place_update(self):
        r=stage.assess(self.info(),A,B,10200);self.assertTrue(r['migrationRequired']);self.assertFalse(r['compatibleInPlace']);self.assertFalse(r['published'])
    def test_unverified_debug_unsigned_wrong_pin_and_downgrade_are_refused(self):
        for key,value in [('verified',None),('debuggable',True),('signerCount',2),('versionCode',10200),('package','other'),('minSdk',None)]:
            info=self.info();info[key]=value
            with self.assertRaises(ValueError):stage.assess(info,A,A,10200)
        with self.assertRaises(ValueError):stage.assess(self.info(),B,A,10200)
        with self.assertRaises(ValueError):stage.assess(self.info(),A,'partial-fingerprint',10200)
    def test_missing_secrets_fail_before_any_private_file_is_created(self):
        with tempfile.TemporaryDirectory() as t:
            d=pathlib.Path(t)/'key'
            with self.assertRaises(SystemExit):material.materialize(d,pathlib.Path(t)/'props',{})
            self.assertFalse(d.exists())
    def env(self):
        return dict(MELK_KEYSTORE_BASE64=base64.b64encode(b'x'*100).decode(),MELK_STORE_PASSWORD='secret-store-value',MELK_KEY_PASSWORD='secret-key-value',MELK_KEY_ALIAS='private-alias',MELK_RELEASE_CERT_SHA256=hashlib.sha256(b'certificate').hexdigest())
    def test_materialized_files_are_private_and_secret_values_are_not_printed(self):
        with tempfile.TemporaryDirectory() as t:
            props=pathlib.Path(t)/'props';env=self.env();out=io.StringIO()
            with patch.object(material.subprocess,'run',return_value=type('Result',(),{'returncode':0,'stdout':b'certificate'})()),contextlib.redirect_stdout(out):material.materialize(pathlib.Path(t)/'key',props,env)
            self.assertEqual(stat.S_IMODE(props.stat().st_mode),0o600)
            self.assertEqual(stat.S_IMODE((pathlib.Path(t)/'key/release.p12').stat().st_mode),0o600)
            for name in material.NAMES:self.assertNotIn(env[name],out.getvalue())
    def test_wrong_certificate_pin_removes_private_files(self):
        with tempfile.TemporaryDirectory() as t:
            props=pathlib.Path(t)/'props';d=pathlib.Path(t)/'key'
            with patch.object(material.subprocess,'run',return_value=type('Result',(),{'returncode':0,'stdout':b'wrong-certificate'})()):
                with self.assertRaises(SystemExit):material.materialize(d,props,self.env())
            self.assertFalse(d.exists());self.assertFalse(props.exists())
    def test_java_properties_escape_password_metacharacters(self):
        self.assertEqual(material.property_value(' a=b:c\\d\ne'),r'\ a\=b\:c\\d\ne')
    def test_enrollment_requires_reviewers_and_only_main_not_tags_or_wildcards(self):
        policy={'deployment_branch_policy':{'custom_branch_policies':True},'protection_rules':[{'type':'required_reviewers','reviewers':[{'type':'User'}]}]}
        self.assertTrue(enrollment.protected_environment(policy,[{'name':'main','type':'branch'}]))
        self.assertFalse(enrollment.protected_environment({},[{'name':'main','type':'branch'}]))
        for branches in [[],[{'name':'*','type':'branch'}],[{'name':'main','type':'tag'}],[{'name':'main'},{'name':'feature/*'}]]:
            self.assertFalse(enrollment.protected_environment(policy,branches))

if __name__=='__main__':unittest.main()
